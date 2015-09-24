#!/usr/bin/python
'''
Created on Jul 2, 2012

@author: Daniele Kruse, Alex Iribarren
'''

from server import Server
from datetime import datetime
from math import floor
import getopt, sys
import config
import logging


logFormatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
rootLogger = logging.getLogger()
rootLogger.setLevel(logging.INFO)

fileHandler = logging.FileHandler('%s/druid_agent.log' % config.tsmdb)
fileHandler.setFormatter(logFormatter)
rootLogger.addHandler(fileHandler)
consoleHandler = logging.StreamHandler()
consoleHandler.setFormatter(logFormatter)
rootLogger.addHandler(consoleHandler)


def usage():
    print "USAGE:"
    print sys.argv[0] + " [-s server_name] [-f frequency] [-t table_name(s)] [-o outputdir]"
    print
    print "Please specify a server using the -s option. To select which tables to dump, you can either use the -f option specifying the frequency (ALL, DAILY, HOURLY, FIVELY), XOR use the -t option along with the name of the table (or tables, as a comma separated list) you would like to dump."

def main():
    servername = config.server
    frequency = ''
    table_names = []
    outputdir = config.tsmdb
    all_servers = 0
    try:
        opts, _ = getopt.getopt(sys.argv[1:], "ho:f:t:s:")
    except getopt.GetoptError, err:
        # print help information and exit:
        print str(err) # will print something like "option -a not recognized"
        usage()
        sys.exit(2)
    for o, a in opts:
        if o == "-s":
            servername = a.upper()
        elif o == "-f":
            frequency = a.upper()
        elif o == "-t":
            table_names = [config.tags.get(x, x) for x in a.upper().split(',')]
        elif o == "-o":
            outputdir = a
        elif o == "-h":
            usage()
            sys.exit()
        else:
            assert False, "unhandled option"

    if servername == '' or (frequency == '' and not table_names):
        usage()
        sys.exit()

    # round the date to 5 minutes and forget about any better resolution
    now = datetime.now()
    timedate_string = str(now.replace(minute=5*int(floor(now.minute/5)),second=0,microsecond=0))

    server = Server(servername, outputdir, frequency, timedate_string, table_names)
    server.readData()
    server.writeData()


if __name__ == '__main__':
    main()
