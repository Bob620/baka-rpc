const crypto = require('crypto');

module.exports = {
	// https://gist.github.com/jed/982883
	generateV4: () => ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,b=>(b^crypto.rng(1)[0]%16>>b/4).toString(16))
};