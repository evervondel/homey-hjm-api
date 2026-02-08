'use strict';

const Homey = require('homey');

module.exports = {
  list_devices(data, callback) {
    Homey.emit('list_devices', {}, (err, devices) => {
      callback(err, devices);
    });
  }
};