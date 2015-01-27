import csv
import sys
import datetime
import os
import argparse
import logging

# file for logged information
egroups_logfile = "/var/log/druid/egroups.log"

DRUID_UTILS_DIR = os.path.dirname(sys.argv[0])
sys.path.append(DRUID_UTILS_DIR)
sys.path.append(os.path.join(DRUID_UTILS_DIR, "egroups"))
from egroups_web_service import Egroup


motherOfAllGroups = "it-service-backup"
motherOfAllGroupsnotify = motherOfAllGroups + "-notify"

# created egroups automatically expire after daysBeforeExpiration
#  so that depreacted egroups are automatically deleted
daysBeforeExpiration = 90

# import splunk python libraries
splunklib = sys.argv[1]

sys.path.append(splunklib)
import splunk.Intersplunk

# setup log infrastructure
# create logger for this module
updateegroups_logger = logging.getLogger('updateegroups')
updateegroups_logger.setLevel(logging.DEBUG)
# create file handler with a higher log level
fh = logging.FileHandler(egroups_logfile)
fh.setLevel(logging.DEBUG)
# create formatter and add it to the handlers
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
fh.setFormatter(formatter)
# add the handlers to the logger
updateegroups_logger.addHandler(fh)


# parse arguments from command-line and set a couple of variables splunk way
updateegroups_logger.debug("Called with those arguments")
myargs = []
for arg in sys.argv[2:]:
    myargs.append("--" + arg)
    updateegroups_logger.debug("arg: " + arg)

def str2bool(v):
    return v.lower() in ("yes", "true", "t", "1")

parser = argparse.ArgumentParser()
parser.register('type', 'mybool', str2bool)
parser.add_argument('-i', '--init', type='mybool', default="False", help="create all the empty groups needed and add them to " + motherOfAllGroups + " egroup (Default)")
parser.add_argument('-f', '--fill', type='mybool', default="False", help="fill initialized egroups with members")
parser.add_argument('-t', '--tsmserverfield', type=str, default="tsmserver", help="field name containing the tsmserver name")
parser.add_argument('-b', '--buildingfield', type=str, default="BUILDING", help="field name containing the BUILDING number")
parser.add_argument('-c', '--contactfield', type=str, default="CONTACT", help="field name containing the CONTACT name")

args = parser.parse_args(myargs)

# by default initialize egroup if no
if ((not args.fill) and (not args.init)):
    initializeEgroups = True
    fillEgroups = False
else:
    initializeEgroups = args.init
    fillEgroups = args.fill


splunkresults = splunk.Intersplunk.readResults(None, None, True)

# pull MOAG
MOAG = Egroup()
if not MOAG.pull(motherOfAllGroups):
    sys.exit(1)

# pull MOAGnotify
MOAGnotify = Egroup()
if not MOAGnotify.pull(motherOfAllGroupsnotify):
    sys.exit(1)

# Create a new egroup or refresh an existing one emptying all the members
# egroupName defines the base name for the updated
# isBuilding defines the generated e-group name and description
# date defines an expiration date for the generated e-group
def create_or_refresh_egroup_from_MOAG (egroupName, isBuilding, date):
    myEgroupName = ""
    # create an empty egroup
    egroup = Egroup()
    # take most of the information from MOAG
    egroup.clone(MOAG)
    egroup.setExpiryDate(date)
    if not isBuilding:
        myEgroupName = motherOfAllGroups + "-" + egroupName
        egroup.setName(myEgroupName)
        egroup.setDescription(MOAG.getDescription() + " on " + egroupName)
        egroup.asyncAddEmailMember(motherOfAllGroupsnotify)
    else:
        myEgroupName = motherOfAllGroups + "-b" + egroupName
        egroup.setName(myEgroupName)
        egroup.setDescription(MOAG.getDescription() + " in Building " + egroupName)
    return (myEgroupName, egroup.push()) # there may be an issue but it is logged anyway...


def addMembersToEgroup (egroupName, members):
    myEgroupName = motherOfAllGroups + "-" + egroupName
    # create an empty egroup
    egroup = Egroup()
    if not egroup.pull(myEgroupName):
        return (myEgroupName, -1)
    egroup.syncAddEmailMembers(members)
    return (myEgroupName, egroup.countMembers())


# let's get the results from splunk
csvEgroups = {}
csvBuildings = {}
updateegroups_logger.debug("Reading input data from Splunk")
for result in splunkresults:
    myEgroupName = result[args.tsmserverfield].lower()
    myContactName = result[args.contactfield].lower()
    myBuildingNumber = result[args.buildingfield].lower()
    updateegroups_logger.debug("egroupName: " + myEgroupName + " contactName: " + myContactName + " Building Number: " + myBuildingNumber)
    if myBuildingNumber in csvBuildings:
        csvBuildings[myBuildingNumber].append(motherOfAllGroups + "-" + myEgroupName)
    else:
        csvBuildings[myBuildingNumber] = [motherOfAllGroups + "-" + myEgroupName]
    if myEgroupName in csvEgroups:
        csvEgroups[myEgroupName].append(myContactName)
    else:
        csvEgroups[myEgroupName] = [myContactName]


# This part initializes all the e-groups required with an empty list of members
#  and remove those egroups from MOAG
#  egroups are initialized with an expiration date of (today + daysBeforeExpiration)
initializedEgroups = {}
if initializeEgroups:
    updateegroups_logger.debug("Initializing egroups")
    expirationDate = datetime.date.today() + datetime.timedelta(days=daysBeforeExpiration)
    expirationDateString = str(expirationDate)
    for egroupName in csvEgroups:
        returnedName, returnedStatus = create_or_refresh_egroup_from_MOAG(egroupName, False, expirationDateString)
        initializedEgroups[returnedName] = returnedStatus
    for buildingNumber in csvBuildings:
        returnedName, returnedStatus = create_or_refresh_egroup_from_MOAG(buildingNumber, True, expirationDateString)
        initializedEgroups[returnedName] = returnedStatus
    # Reset MOAG
    MOAG.empty()
    MOAG.asyncAddEmailMember(motherOfAllGroupsnotify)
    # adds it to Splunk results
    initializedEgroups[motherOfAllGroups] = MOAG.push()


# This part adds all the members to the corresponding e-groups
filledEgroups = {}
buildingEgroups = []
if fillEgroups:
    updateegroups_logger.debug("Filling egroups")
    for egroupName in csvEgroups:
        returnedName, returnedStatus = addMembersToEgroup(egroupName, csvEgroups[egroupName])
        filledEgroups[returnedName] = returnedStatus
    for buildingNumber in csvBuildings:
        returnedName, returnedStatus = addMembersToEgroup("b" + buildingNumber, csvBuildings[buildingNumber])
        filledEgroups[returnedName] = returnedStatus
        buildingEgroups.append(returnedName)
    # Fill MOAG
    MOAG.syncAddEmailMembers(buildingEgroups)
    # report changes to Splunk
    filledEgroups[motherOfAllGroups] = MOAG.countMembers()

# feed splunk with results
splunkOutputResults = []
if initializeEgroups:
    for egroupName in initializedEgroups:
        resultRow = {"egroupname": egroupName, "initialized": initializedEgroups[egroupName]}
        if fillEgroups:
            resultRow["filled"]=filledEgroups[egroupName]
        splunkOutputResults.append(resultRow)
else:
    for egroupName in filledEgroups:
        splunkOutputResults.append({"egroupname": egroupName, "filled": filledEgroups[egroupName]})

splunk.Intersplunk.outputResults(splunkOutputResults)

sys.exit(0)
