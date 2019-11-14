const Uuid = require('./uuid.js');

const constants = require('./constants.json');
const errors = require('./errors.js');

// https://stackoverflow.com/a/31194949
function getFuncArgs(func, test = 'test2') {
	return (func + '')
	.replace(/[/][/].*$/mg,'') // strip single-line comments
	.replace(/\s+/g, '') // strip white space
	.replace(/[/][*][^/*]*[*][/]/g, '') // strip multi-line comments
	.split('){', 1)[0].split('=>', 1)[0].replace(/^[^(]*[(](?=\w*)|[)]/g, '') // extract the parameters
	.split(',').filter(Boolean) // split & filter [""]
	// New code to handle knowing if params are optional
	.map(text => {
		const [param, optional = false] = text.split('='); // split the param from the default value
		return {param, optional: !!optional}; // map param and default to an object
	});
}

function serializeParams(params=[], expectedParams=[]) {
	if (Array.isArray(params)) {
		if (params.length === expectedParams.length)
			return params;
		else if (params.length >= expectedParams.filter(e => !e.optional))
			return params;
	} else
		return expectedParams.map(({param, optional}) => {
			if (params[param])
				return params[param];
			else if (optional)
				return undefined;
			else
				throw 'Invalid params';
		});

	throw 'Invalid params';
}

class BakaRPC {
	constructor(inStream = process.stdin, outStream = process.stdout, {uuid=Uuid.generateV4(), appendNewline=false}) {
		this.data = {
			uuid,
			inStream,
			outStream,
			methods: new Map(),
			awaiting: new Map(),
			batches: [],
			appendNewline
		};

		this.backend = {
			writeObject: str => {
				if (typeof str === 'object')
					this.data.outStream.write(`${JSON.stringify(str)}${this.data.appendNewline ? '\n' : ''}`);
				else
					this.data.outStream.write(`${str}${this.data.appendNewline ? '\n' : ''}`);
			},

			handleNotification: ({method, params = undefined}) => {
				try {
					if (this.data.methods.has(method)) {
						const {call, params: expectedParams} = this.data.methods.get(method);
						call(...serializeParams(params, expectedParams));
					}
				} catch(err) {}
			},

			handleMethod: async ({method, params = undefined, id}) => {
				if (this.data.methods.has(method))
					try {
						const {call, params: expectedParams} = this.data.methods.get(method);
						try {
							if (typeof params === 'object') {
								const result = call(...serializeParams(params, expectedParams));

								return {
									jsonrpc: constants.JSON_RPC_VERSION,
									result: result === undefined ? true : result,
									id
								};
							} else {
								const result = call(...serializeParams([], expectedParams));

								return {
									jsonrpc: constants.JSON_RPC_VERSION,
									result: result === undefined ? true : result,
									id
								};
							}
						} catch(err) {}

						return errors.rpc.INVALID_PARAMS(id);
					} catch(err) {
						if (this.data.methods.has(constants.errors.METHOD_ERROR)) {
							const save = await this.data.methods.get(constants.errors.METHOD_ERROR).call(method, err);
							if (save !== undefined)
								return {
									jsonrpc: constants.JSON_RPC_VERSION,
									result: save,
									id
								};
							else
								return errors.rpc.METHOD_ERROR(id);
						}
					}
				else
					return errors.rpc.METHOD_NOT_FOUND(id);
			},

			handleResult: ({result, id}) => {
				if (this.data.awaiting.has(id)) {
					this.data.awaiting.get(id).resolve(result);
					this.data.awaiting.delete(id);
				} else
				if (this.data.methods.has(constants.errors.RESPONSE_WITH_UNKNOWN_ID))
					this.data.methods.get(constants.errors.RESPONSE_WITH_UNKNOWN_ID).call(id, result);
			},

			handleError: ({error, id = undefined}) => {
				if (id && this.data.awaiting.has(id)) {
					this.data.awaiting.get(id).reject(error);
					this.data.awaiting.delete(id);
				} else
					if (this.data.methods.has(constants.errors.ERROR_WITH_NO_ID))
						this.data.methods.get(constants.errors.ERROR_WITH_NO_ID).call(error);
			},

			handleBatch: commands => {
				for (let i = 0; i < this.data.batches.length; i++) {
					const {ids, resolve, reject} = this.data.batches[i];
					if (commands.map(({id}) => id).map(id => ids.includes(id)).includes(true)) {
						const results = commands.reduce((commands, command) => {
							commands[command.id] = this.backend.handleBatchResults(command);
							return commands;
						}, {});
						resolve(ids.map(id => results[id]));
						this.data.batches.splice(i, 1);
						return;
					}
				}

				return Promise.all(commands.map(message => {
					try {
						if (Array.isArray(message))
							return errors.rpc.INVALID_REQUEST(message.id);
						if (typeof message === 'object')
							return this.backend.handleMessage(message);
						errors.rpc.INVALID_REQUEST(message.id);
					} catch(err) {
						return err;
					}
				}));
			},

			handleBatchResults: message => {
				const errOrRes = ((message.error || message.result !== undefined)) && !((message.error && message.result !== undefined));
				if (message.jsonrpc && (errOrRes || !(errOrRes && message.method)))
					if (typeof message.jsonrpc === 'string' && message.jsonrpc === constants.JSON_RPC_VERSION)
						if (message.result !== undefined)
							return message.result;
						else if (typeof message.error === 'object')
							return message.error;
				return errors.rpc.INVALID_REQUEST(message.id);
			},

			handleMessage: message => {
				const errOrRes = ((message.error || message.result !== undefined)) && !((message.error && message.result !== undefined));
				if (message.jsonrpc && (errOrRes || !(errOrRes && message.method)))
					if (typeof message.jsonrpc === 'string' && message.jsonrpc === constants.JSON_RPC_VERSION)
						if (message.method) {
							if (typeof message.method === 'string')
								if (message.id == null)
									return this.backend.handleNotification(message);
								else if (typeof message.id === 'number' || typeof message.id === 'string')
									return this.backend.handleMethod(message);
						} else if (message.result !== undefined)
							return this.backend.handleResult(message);
						else if (typeof message.error === 'object')
							return this.backend.handleError(message);
				return errors.rpc.INVALID_REQUEST(message.id);
			}
		};

		inStream.setEncoding('utf8');

		inStream.on('data', async chunk => {
			try {
				const message = JSON.parse(chunk);

				if (Array.isArray(message)) {
					const resolved = await this.backend.handleBatch(message);
					if (resolved !== undefined && resolved.length !== 0)
						this.backend.writeObject(resolved.filter(e => e));
				} else if (typeof message === 'object') {
					const resolved = await this.backend.handleMessage(message);
					if (resolved !== undefined)
						this.backend.writeObject(resolved);
				} else
					this.backend.writeObject(errors.rpc.INVALID_REQUEST(message.id));
			} catch(err) {
				this.backend.writeObject(errors.rpc.PARSE(null));
			}
		});

		inStream.on('close', err => {
			if (this.data.methods.has(constants.errors.IN_STREAM_CLOSED))
				this.data.methods.get(constants.errors.IN_STREAM_CLOSED).call(errors.internal.IN_STREAM_CLOSED(err));
			if (this.data.methods.has(constants.errors.STREAM_CLOSED))
				this.data.methods.get(constants.errors.STREAM_CLOSED).call(errors.internal.IN_STREAM_CLOSED(err));
		});

		outStream.on('close', err => {
			if (this.data.methods.has(constants.errors.OUT_STREAM_CLOSED))
				this.data.methods.get(constants.errors.OUT_STREAM_CLOSED).call(errors.internal.OUT_STREAM_CLOSED(err));
			if (this.data.methods.has(constants.errors.STREAM_CLOSED))
				this.data.methods.get(constants.errors.STREAM_CLOSED).call(errors.internal.OUT_STREAM_CLOSED(err));
		});

		inStream.on('error', err => {
			if (this.data.methods.has(constants.errors.IN_STREAM_ERROR))
				this.data.methods.get(constants.errors.IN_STREAM_ERROR).call(errors.internal.IN_STREAM_ERROR(err));
			if (this.data.methods.has(constants.errors.STREAM_ERROR))
				this.data.methods.get(constants.errors.STREAM_ERROR).call(errors.internal.IN_STREAM_ERROR(err));
		});

		outStream.on('error', err => {
			if (this.data.methods.has(constants.errors.OUT_STREAM_ERROR))
				this.data.methods.get(constants.errors.OUT_STREAM_ERROR).call(errors.internal.OUT_STREAM_ERROR(err));
			if (this.data.methods.has(constants.errors.STREAM_ERROR))
				this.data.methods.get(constants.errors.STREAM_ERROR).call(errors.internal.OUT_STREAM_ERROR(err));
		});
	}

	on(method, listener) {
		if (typeof method !== 'string')
			throw errors.internal.INVALID_METHOD(`Method is not a valid string`);

		if (typeof listener !== 'function')
			throw errors.internal.INVALID_LISTENER('Listener is not a valid function');

		this.data.methods.set(method, {
			call: listener,
			params: getFuncArgs(listener)
		});
	}

	request(method, params=undefined) {
		return new Promise((resolve, reject) => {
			const message = this.makeRequest(method, params);

			this.data.awaiting.set(message.id, {resolve, reject});
			this.backend.writeObject(message);
		});
	}

	makeRequest(method, params=undefined) {
		if (typeof method !== 'string')
			throw errors.internal.INVALID_METHOD(`Method is not a valid string`);

		if (params && typeof params !== 'object')
			throw errors.internal.INVALID_PARAMS('Params is a non-object type (Expected an Array, Object, or Undefined/Null)');

		const id = `${this.data.uuid}.${Uuid.generateV4()}`;
		let message = {
			jsonrpc: constants.JSON_RPC_VERSION,
			method,
			id
		};

		if (params)
			message.params = params;

		return message;
	}

	notification(method, params=undefined) {
			this.backend.writeObject(this.makeNotification(method, params));
	}

	makeNotification(method, params=undefined) {
		if (typeof method !== 'string')
			throw errors.internal.INVALID_METHOD(`Method is not a valid string`);

		if (params)
			if (typeof params === 'object') {
				return {
					jsonrpc: constants.JSON_RPC_VERSION,
					method,
					params
				};
			} else
				throw errors.internal.INVALID_PARAMS('Params is a non-object type (Expected an Array, Object, or Undefined/Null)');
		else
			return {
				jsonrpc: constants.JSON_RPC_VERSION,
				method
			};
	}

	batch(commands) {
		if (!Array.isArray(commands))
			throw errors.internal.INVALID_BATCH('Commands is not an Array (Expected [{type, method, param}])');

		try {
			const ids = commands.map(e => e.id).filter(e => e !== undefined);

			return new Promise((resolve, reject) => {
				this.data.batches.push({ids, resolve, reject});
				this.backend.writeObject(commands);
			});
		} catch (err) {
			throw errors.internal.INVALID_BATCH('Commands is not an Array of commands (Expected [{type, method, param}])')
		}
	}
}

module.exports = {
	BakaRPC,
	errors,
	constants
};