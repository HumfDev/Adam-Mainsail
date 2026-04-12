import board
import busio
import adafruit_ads1x15.ads1115 as ADS
from adafruit_ads1x15.analog_in import AnalogIn

REPORT_TIME = 1.0

class ADS1115Sensor:
    def __init__(self, config):
        self.printer = config.get_printer()
        self.name = config.get_name().split()[-1]
        self.temperature = 0.
        self._callback = None
        self.min_temp = self.max_temp = 0.

        self.i2c = busio.I2C(board.SCL, board.SDA)
        self.ads = ADS.ADS1115(self.i2c)
        self.chan = AnalogIn(self.ads, 0)

        self.printer.add_object("ads1115_sensor " + self.name, self)
        self.printer.register_event_handler("klippy:connect", self._handle_connect)

    def _handle_connect(self):
        reactor = self.printer.get_reactor()
        self.sample_timer = reactor.register_timer(self._update, reactor.monotonic() + 1.)

    def _update(self, eventtime):
        try:
            self.temperature = self.chan.voltage
            if self._callback:
                self._callback(eventtime, self.temperature)
        except Exception:
            pass
        return eventtime + REPORT_TIME

    def setup_minmax(self, min_temp, max_temp):
        self.min_temp = min_temp
        self.max_temp = max_temp

    def setup_callback(self, cb):
        self._callback = cb

    def get_report_time_delta(self):
        return REPORT_TIME

    def get_temp(self, eventtime):
        return self.temperature, 0.

    def get_status(self, eventtime):
        return {'temperature': self.temperature}

def load_config(config):
    pheaters = config.get_printer().load_object(config, "heaters")
    pheaters.add_sensor_factory("ADS1115", ADS1115Sensor)

def load_config_prefix(config):
    pheaters = config.get_printer().load_object(config, "heaters")
    pheaters.add_sensor_factory("ADS1115", ADS1115Sensor)
