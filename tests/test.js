const { spawn } = require('child_process');

const { BakaRPC, constants} = require('../index.js');

const tests = require('./test.json');

const client = spawn('node', ['./tests/client.js'], {
	stdio: ['pipe', 'pipe', 'inherit']
});

const rpc = new BakaRPC(client.stdout, client.stdin);

for (const {method, result} of tests)
	rpc.on(method, () => {
		if (result !== undefined)
			if (result === "undefined") {
				return undefined;
			} else
				return result
	});
/*
rpc.on('echo', (str) => {
	//console.log(`(RPC1) Echo: ${str}`);
});

rpc.on('false', () => {
	return false;
});

rpc.on('falsy', () => {
	return '';
});

rpc.on('true', () => {
	return true;
});

rpc.on('object', () => {
	return {test: 'tes2t'};
});

rpc.on('empty', () => {
	return {};
});

rpc.on(constants.errors.STREAM_CLOSED, err => {
	//console.log('(test): ');
	//console.log(err);
});

rpc.on(constants.errors.STREAM_ERROR, err => {
	//console.log('(test): ');
	//console.log(err);
});
*/