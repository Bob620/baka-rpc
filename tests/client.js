const { BakaRPC, constants } = require('../index.js');

const tests = require('./test.json');

const rpc = new BakaRPC();

rpc.on(constants.errors.STREAM_CLOSED, err => {
	console.error(err);
});

rpc.on(constants.errors.STREAM_ERROR, err => {
	console.error(err);
});

async function runTests(tests) {
	try {
		for (const {method, expects, params} of tests) {
			const result = await rpc.request(method, params);
			if (expects === result)
				console.error(`(${method}): PASS`);
			else if (Array.isArray(expects) && Array.isArray(result)) {
				if (expects.length === result.length && !expects.map(e => result.includes(e)).includes(false))
					console.error(`(${method}): PASS`);
				else
					console.error(`(${method}): FAIL\n\tGot: ${result}\n\tExpected: ${expects}`);
			} else if (typeof expects === 'object' && typeof result === 'object') {
				const expectsKeys = Object.keys(expects);
				const expectsValues = Object.values(expects);
				const resultKeys = Object.keys(result);
				const resultValues = Object.values(result);

				if (expectsKeys.length !== resultKeys.length || expectsKeys.map(e => resultKeys.includes(e)).includes(false)) {
					console.error(`(${method}): FAIL\n\tGot:`);
					console.error(expects);
					console.error(`\tExpected:`);
					return console.error(expects);
				}

				if (expectsValues.length !== resultValues.length || expectsValues.map(e => resultValues.includes(e)).includes(false)) {
					console.error(`(${method}): FAIL\n\tGot:`);
					console.error(expects);
					console.error(`\tExpected:`);
					return console.error(expects);
				}

				console.error(`(${method}): PASS`);
			} else
				console.error(`(${method}): FAIL\n\tGot: ${result}\n\tExpected: ${expects}`);
		}
	} catch (err) {
		console.error(err);
	}
	process.exit();
}

async function test() {
	try {
		console.error(await rpc.request('test'));
		console.error(await rpc.request('echo', {str: 'test2'}));
		console.error(await rpc.request('true'));
		console.error(await rpc.request('empty'));
		console.error(await rpc.request('object'));
		console.error(await rpc.request('false'));
		console.error(await rpc.request('falsy'));
		rpc.notification('test');
		console.error(await rpc.batch([
			rpc.makeNotification('test'),
			rpc.makeRequest('test'),
			rpc.makeRequest('truthy'),
			rpc.makeRequest('echo'),
			rpc.makeNotification(''),
			rpc.makeRequest(''),
			rpc.makeRequest('echo', ['test3'])
		]));
	} catch (err) {
		console.error(err);
	}
}

runTests(tests);