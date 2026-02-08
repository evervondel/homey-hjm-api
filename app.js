'use strict';

const Homey = require('homey');
const HjmClient = require('./lib/hjm-client');

class HjmApiApp extends Homey.App {
  async onInit() {
    this.log('homey-hjm-api started');

    // Log when app settings change
    //this.homey.settings.on('set', (key) => this.log('Setting set:', key));
    //this.homey.settings.on('unset', (key) => this.log('Setting unset:', key));
  }

  getConfig() {
    return {
      baseUrl: 'https://api-hjm.helki.com',
      tokenPath: '/client/token',
      clientId: this.homey.settings.get('clientId'),
      clientSecret: this.homey.settings.get('clientSecret'),
      username: this.homey.settings.get('username'),
      password: this.homey.settings.get('password'),
    };
  }

  createClient() {
    const cfg = this.getConfig();
    const debug = !!this.homey.settings.get('debugRest');
    return new HjmClient(Object.assign({}, cfg, { debug, logger: this.log.bind(this) }));
  }
}

module.exports = HjmApiApp;
