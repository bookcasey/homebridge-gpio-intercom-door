var wpi = require("wiring-pi");

var Service, Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-gpio-intercom-door", "IntercomDoor", LockAccessory);
};

function IntercomDoorAccessory(log, config) {
  this.log = log;
  this.name = config["name"];
  this.pin = config['pin'];
  this.duration = config['duration'];
  this.service = new Service.LocMechanism(this.name);

  if (!this.pin) throw new Error('You must provide a config value for pin.');
  if(!this.duration) throw new Error('You must provide a duration');
  if(!is_int(this.duration) && this.duration > 0) throw new Error('Duration must be a positive integer');

  wpi.setup('sys');
  wpi.pinMode(this.pin, wpi.OUTPUT);

  this.service
    .getCharacteristic(Characteristic.LockTargetState)
    .on('set', this.setState.bind(this));
}

IntercomDoorAccessory.prototype.setState = function (state, callback) {
    var self = this;
    callback = callback || function() {};
    if (this.lockTimer) {
        clearTimeout(this.lockTimer);
        delete this.lockTimer;
    }

    var currentState;

    if (state == Characteristic.LockTargetState.SECURED) {
      this.pinAction(0);
      currentState = Characteristic.LockCurrentState.SECURED;
    } else {
      this.pinAction(1);
      currentState = Characteristic.LockCurrentState.UNSECURED;
    }

    this.service
        .setCharacteristic(Characteristic.LockCurrentState, currentState);

    if (state == Characteristic.LockTargetState.UNSECURED) {
        this.lockTimer = setTimeout(
            function(caller) {
                self.pinAction(0);
                caller.service.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.SECURED);
                caller.service.getCharacteristic(Characteristic.LockCurrentState).updateValue(Characteristic.LockCurrentState.SECURED);
                console.log('timer over');
            },
            this.duration,
            this
        );
    }
    callback();
};

IntercomDoorAccessory.prototype.getServices = function() {
  return [this.service];
};

IntercomDoorAccessory.prototype.pinAction = function(action) {
    this.log('Turning ' + (action == 1 ? 'on' : 'off') + ' pin #' + this.pin);

    var self = this;
    wpi.digitalWrite(self.pin, action);
    var success = (wpi.digitalRead(self.pin) == action);
    return success;
};

var is_int = function(n) {
    return n % 1 === 0;
};
