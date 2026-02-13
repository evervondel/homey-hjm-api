'use strict';

const Homey = require('homey');
const HjmClient = require('./lib/hjm-client');

class HjmApiApp extends Homey.App {
  async onInit() {
    super.onInit();
    this.log('homey-hjm-api started');
  }

getConfig() {
    // Safety: If this.homey isn't ready, try to use the global Homey.ManagerSettings
    const settings = this.homey ? this.homey.settings : Homey.ManagerSettings;

    if (!settings) {
      throw new Error('Homey Settings Manager not available');
    }

    return {
      baseUrl: 'https://api-hjm.helki.com',
      tokenPath: '/client/token',
      clientId: settings.get('clientId'),
      clientSecret: settings.get('clientSecret'),
      username: settings.get('username'),
      password: settings.get('password'),
    };
  }

  createClient() {
    const cfg = this.getConfig();
    // Use the same safety for the debug toggle
    const settings = this.homey ? this.homey.settings : Homey.ManagerSettings;
    const debug = !!settings.get('debugRest');
    
    return new HjmClient(Object.assign({}, cfg, { 
      debug, 
      logger: this.log.bind(this) 
    }));
  }
}

module.exports = HjmApiApp;
