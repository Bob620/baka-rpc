const constants = require('./constants.json');

/*
	-32700 				Parse error			Invalid JSON was received by the server.
	-32600 				Invalid Request 	The JSON sent is not a valid Request object.
	-32601 				Method not found	The method does not exist / is not available.
	-32602 				Invalid params		Invalid method parameter(s).
	-32603 				Internal error		Internal JSON-RPC error.
	-32000 to -32099	Server error		Reserved for implementation-defined server-errors.
*/

module.exports = {
	rpc: {
		PARSE: (id=null) => ({
			jsonrpc: constants.JSON_RPC_VERSION,
			error: {
				code: -32700,
				message: 'Parse error'
			},
			id
		}),
		INVALID_REQUEST: (id=null) => ({
			jsonrpc: constants.JSON_RPC_VERSION,
			error: {
				code: -32600,
				message: 'Invalid request'
			},
			id
		}),
		METHOD_NOT_FOUND: (id=null) => ({
			jsonrpc: constants.JSON_RPC_VERSION,
			error: {
				code: -32601,
				message: 'Method not found'
			},
			id
		}),
		INVALID_PARAMS: (id=null) => ({
			jsonrpc: constants.JSON_RPC_VERSION,
			error: {
				code: -32602,
				message: 'Invalid params'
			},
			id
		}),
		INTERNAL_ERROR: (id=null) => ({
			jsonrpc: constants.JSON_RPC_VERSION,
			error: {
				code: -32603,
				message: 'Internal error'
			},
			id
		}),
		METHOD_ERROR: (id=null) => ({
			jsonrpc: constants.JSON_RPC_VERSION,
			error: {
				code: -32000,
				message: 'Method encountered an error'
			},
			id
		})
	},
	internal: {
		IN_STREAM_CLOSED: error => ({
			code: 1,
			message: 'In stream closed unexpectedly',
			error
		}),
		OUT_STREAM_CLOSED: error => ({
			code: 2,
			message: 'Out stream closed unexpectedly',
			error
		}),
		IN_STREAM_ERROR: error => ({
			code: 3,
			message: 'In stream threw an error',
			error
		}),
		OUT_STREAM_ERROR: error => ({
			code: 4,
			message: 'Out stream threw an error',
			error
		}),
		INVALID_PARAMS: error => ({
			code: 5,
			message: 'Invalid params',
			error
		}),
		INVALID_METHOD: error => ({
			code: 6,
			message: 'Invalid method name',
			error
		}),
		INVALID_LISTENER: error => ({
			code: 7,
			message: 'Invalid listener',
			error
		}),
		INVALID_BATCH: error => ({
			code: 8,
			message: 'Invalid batch',
			error
		})
	}
};