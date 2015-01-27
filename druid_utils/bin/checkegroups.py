import sys
import os
import argparse

DRUID_UTILS_DIR = os.path.dirname(sys.argv[0])
sys.path.append(DRUID_UTILS_DIR)
sys.path.append(os.path.join(DRUID_UTILS_DIR, "egroups"))
from egroups_web_service import Egroup

# import splunk python libraries
splunklib = sys.argv[1]

sys.path.append(splunklib)
import splunk.Intersplunk


# still need MOAG name to deduce the egroup names
motherOfAllGroups = "it-service-backup"
# egroup we use to send emails
sender = "tsm-admin"


# parse arguments from command-line and set a couple of variables splunk way
myargs = []
for arg in sys.argv[2:]:
    myargs.append("--" + arg)

def str2bool(v):
    return v.lower() in ("yes", "true", "t", "1")

parser = argparse.ArgumentParser()
parser.register('type', 'mybool', str2bool)
parser.add_argument('-e', '--egroupnamefield', type=str, default="egroupname", help="field name containing the egroupName value")
parser.add_argument('-x', '--existence', type='mybool', default="False", help="check if egroup exists")

args = parser.parse_args(myargs)


##
# Some usefull functions

# check if sender can send and email to an egroup
def check_member_email(egroupMember):
    # tsm-admin can send emails to any egroup
    return True


# get all the members of a given egroup and check all the members
def check_egroup_members_email (egroupName):
    result = []
    # create an empty egroup
    egroup = Egroup()
    if egroup.pull(egroupName):
        if not "Members" in egroup.egroup:
            return result
        for member in egroup.egroup.Members: # getMembers
            result.append({"egroupname": egroupName, "contact": member.Name, "acceptemails": check_member_email(member)})
    return result




splunkresults = splunk.Intersplunk.readResults(None, None, True)

# let's get the results from splunk
egroupsToCheck = []
for result in splunkresults:
    if not args.egroupnamefield in result:
        continue
    egroupName = result[args.egroupnamefield].lower()
    if egroupName not in egroupsToCheck:
        egroupsToCheck.append(egroupName)

# feed splunk with results
splunkOutputResults = []
tempegroup = Egroup()
for egroupName in egroupsToCheck:
    if args.existence: # only reports if the egroup exists
        splunkOutputResults.append({"egroupname": egroupName, "existence": tempegroup.pull(egroupName)})
    else:
        splunkOutputResults.extend(check_egroup_members_email(egroupName))

splunk.Intersplunk.outputResults(splunkOutputResults)

sys.exit(0)
