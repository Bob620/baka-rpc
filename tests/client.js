const { BakaRPC, constants } = require('../index.js');

const rpc = new BakaRPC();

rpc.on(constants.errors.STREAM_CLOSED, err => {
	console.error(err);
});

rpc.on(constants.errors.STREAM_ERROR, err => {
	console.error(err);
});

async function test() {
	try {
		console.error(await rpc.request('test'));
		console.error(await rpc.request('echo', {str: 'test2'}));
		console.error(await rpc.request('truthy'));
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

test();