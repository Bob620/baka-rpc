const { spawn } = require('child_process');

const { BakaRPC, constants} = require('../index.js');

const client = spawn('/usr/bin/node', ['./tests/client.js'], {
	stdio: ['pipe', 'pipe', 'inherit']
});

//client.stdout.on('data', console.log);

const rpc = new BakaRPC(client.stdout, client.stdin);


rpc.on('test', () => {
	console.log(`(RPC1) Test: test`);
});

rpc.on('echo', (str) => {
	console.log(`(RPC1) Echo: ${str}`);
});

rpc.on('false', () => {
	return false;
});

rpc.on('falsy', () => {
	return '';
});


rpc.on('truthy', () => {
	return true;
});

rpc.on(constants.errors.STREAM_CLOSED, err => {
	console.log('(test): ');
	console.log(err);
});

rpc.on(constants.errors.STREAM_ERROR, err => {
	console.log('(test): ');
	console.log(err);
});