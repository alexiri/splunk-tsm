import sys
import os
import config
import logging

_SPLUNK_PYTHON_PATH = sys.argv.pop(1)
sys.path.append(_SPLUNK_PYTHON_PATH)

from suds.client import Client
from suds.sax.element import Element
from suds.xsd.doctor import ImportDoctor, Import

import splunk.Intersplunk

# file for logged information
dns_logfile = "/var/log/druid/dns.log"

# setup log infrastructure
# create logger for this module
updatedns_logger = logging.getLogger('updatedns')
updatedns_logger.setLevel(logging.INFO)
# create file handler with a higher log level
fh = logging.FileHandler(dns_logfile)
fh.setLevel(logging.DEBUG)
# create formatter and add it to the handlers
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
fh.setFormatter(formatter)
# add the handlers to the logger
updatedns_logger.addHandler(fh)

(isgetinfo, sys.argv) = splunk.Intersplunk.isGetInfo(sys.argv)

if isgetinfo:
    splunk.Intersplunk.outputInfo(False, True, False, False, None, False)

# Authentication information
CFG = config.getConfig()
type = ''

url = 'https://network/soap/soap.fcgi?v=5&WSDL'
imp = Import('http://schemas.xmlsoap.org/soap/encoding/')
d   = ImportDoctor(imp)

client     = Client(url, doctor=d, cache=None)
token      = client.service.getAuthToken(CFG['user'], CFG['password'], type)
authTok    = Element('token').setText(token)
authHeader = Element('Auth').insert(authTok)

client.set_options(soapheaders=authHeader)

result = client.service.dnsZoneUpdate('BACKUP.YOU.COM', { 'External':0, 'Internal':1 })

updatedns_logger.info("DNS update return code: %s" % result)
splunk.Intersplunk.outputResults([{'DNS Refreshed': result}])
