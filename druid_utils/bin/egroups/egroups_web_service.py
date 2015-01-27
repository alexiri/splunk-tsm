from suds.client import Client
import logging
import re
import inspect
import config
import datetime


# Authentication
CFG = config.getConfig()
# set url of webservice wsdl
egroup_wsdl_url = ''
# file for logged information
egroups_logfile = "/var/log/druid/egroups.log"
# warning if webservice takes more than warning_web_timeout to reply
web_warning_timeout = 5

# create logger for this module
egroup_logger = logging.getLogger('egroup_management')
egroup_logger.setLevel(logging.DEBUG)
# create logger with 'suds.client'
client_logger = logging.getLogger('suds.client')
client_logger.setLevel(logging.WARNING)
resolver_loggger = logging.getLogger('suds.resolver')
resolver_loggger.setLevel(logging.WARNING)
# create file handler with a higher log level
fh = logging.FileHandler(egroups_logfile)
fh.setLevel(logging.DEBUG)
# create formatter and add it to the handlers
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
fh.setFormatter(formatter)
# add the handlers to the logger
egroup_logger.addHandler(fh)
client_logger.addHandler(fh)
resolver_loggger.addHandler(fh)



class EgroupsWebService(object):

    __client = None

    def __init__(self):
        if EgroupsWebService.__client is None:
            egroup_logger.debug("EgroupsWebService(): creating a new connection")
            try:
                EgroupsWebService.__client = Client(egroup_wsdl_url, username=CFG['user'], password=CFG['password'])
            except Exception, e:
                egroup_logger.error("Exception caught when trying to connect to the webservice using this URL: " + egroup_wsdl_url + " : " + str(e))
        else:
            egroup_logger.debug("EgroupsWebService(): reusing the connection that exists")
        # to get some feedback about the available SOAP functions
        #egroup_logger.debug(str(self.__client))

    def SOAPService(self, called_function, *args):
        egroup_logger.debug("SOAPService(" + called_function + "): issuing request to webservice ")
        for myarg in args:
            egroup_logger.debug("SOAPService(" + called_function + "): arg " + str(myarg))
        if self.__client is None:
            egroup_logger.error("No connection established with the web service, cannot dispatch " + called_function + ". Please check previous service connection error, or make sure that a connection exists.")
            return None
        calling_time = datetime.datetime.today()
        # some issues can happen here as well because it is the point where we are contacting the SOAP webservice...
        try:
            result = getattr(self.__client.service, called_function)(*args)
        except Exception, e:
            egroup_logger.error("Exception caught when calling (" + called_function + ") with the previous args: " + str(e))
            return None
        web_responsetime = (datetime.datetime.today() - calling_time).seconds
        egroup_logger.debug("SOAPService(" + called_function + "): returning from webservice request: webservice response time was " + str(web_responsetime) + " seconds")
        if (web_responsetime > web_warning_timeout):
            egroup_logger.warning("SOAPService(" + called_function + "): webservice response time was " + str(web_responsetime) + " seconds > " + str(web_warning_timeout) + " seconds")

        if "error" in result:
            egroup_logger.error("SOAP Error (" + result.error.Code + "): " + result.error.Message)
            return None
        elif "warnings" in result:
            for warning in result.warnings:
                egroup_logger.warning("SOAP Warning (" + warning.Code + "): " + warning.Message)
        return result

    def FindEgroupByName(self, egroupName):
        return self.SOAPService("FindEgroupByName", egroupName)

    def SynchronizeEgroup(self, modEgroup):
        egroup_logger.debug(modEgroup)
        return self.SOAPService("SynchronizeEgroup", modEgroup)

    def DeleteEgroup(self, egroupName):
        return self.SOAPService("DeleteEgroup", egroupName)

    def AddEgroupMembers(self, egroupName, overwriteMembers, members):
        return self.SOAPService("AddEgroupMembers", egroupName, overwriteMembers, members)

    def RemoveEgroupEmailMembers(self, egroupName, members):
        return self.SOAPService("RemoveEgroupEmailMembers", egroupName, members)


class Egroup(EgroupsWebService):

    egroup = None
    dirty = None # dirty flag cached object is dirty if 1, clean otherwise


    # create an empty egroup object
    def __init__(self):
        egroup_logger.debug("Egroup(): Creating an egroup")
        super(Egroup, self).__init__()
        self.egroup = None
        self.dirty = 0


    # pull egroup from webservice
    def pull(self, egroupName):
        tempResult = self.FindEgroupByName(egroupName)
        self.egroup = None
        if tempResult is not None:
            self.egroup = self.FindEgroupByName(egroupName).result
        self.dirty = 0
        if self.egroup is None:
            return False
        return True


    # push egroup to webservice
    def push(self):
        result = self.dirty
        if (self.dirty == 1):
            egroup_logger.debug("push(" + self.egroup.Name + "): pushing dirty egroup to webservice")
            if self.SynchronizeEgroup(self.egroup):
                self.dirty = 0
            else: # Failed to push
                egroup_logger.debug("failed to push egroup")
                return False
        return True


    # delete egroup from webservice
    def syncDelete(self):
        if (self.egroup is not None) and ("Name" in self.egroup) and (self.DeleteEgroup(self.egroup.Name)):
            egroup = None
            self.dirty = 0
            return True
        return False


    # empty the members of an egroup
    def empty(self):
        if (self.egroup is not None) and ("Members" in self.egroup):
            self.egroup.Members = []
            self.dirty = 1
            return True
        return False

    # count members
    def countMembers(self):
        if self.dirty == 1:
            if self.pull(self.egroup.Name):
                return len(self.egroup.Members)
            else:
                return -1
        else:
            if (self.egroup is not None) and ("Members" in self.egroup):
                return len(self.egroup.Members)
            return -1


    # change egroup name
    # if pushed creates a new egroup or refresh an existing one with the same name
    def setName(self, egroupName):
        if (self.egroup is not None) and ("Name" in self.egroup):
            self.egroup.Name = egroupName
            self.egroup.ID = None
            self.dirty = 1
            return True
        return False


    # change the description of an egroup
    def setDescription(self, description):
        if (self.egroup is not None) and ("Description" in self.egroup):
            self.egroup.Description = description
            self.dirty = 1
            return True
        return False


    def getDescription(self):
        if (self.egroup is not None) and ("Description" in self.egroup):
            return self.egroup.Description
        return ""


    # set expiry date format is YYYY-MM-DD
    def setExpiryDate(self, date):
        if (self.egroup is not None):
            self.egroup.ExpiryDate = date
            self.dirty = 1
            return True
        return False


    # clone all info from another e-group
    # everything except Name, ID (cannot rename an egroup) and Members
    # Name is "" needs to be set later
    # convenient if MOAG changes
    def clone(self, sourceEgroup):
      if not self.pull(sourceEgroup.egroup.Name):
        return False
      self.setName("")
      self.empty()
      return True


    # synchronously add email members
    def syncAddEmailMembers(self, emails):
        self.empty()
        for email in emails:
            self.asyncAddEmailMember(email)
        # this False specify that users are added to existing ones
        #  True would replace all the members  by provided list
        return self.AddEgroupMembers(self.egroup.Name, False, self.egroup.Members)


    # add egroup member by email
    def asyncAddEmailMember(self, email):
        email = email.lower()
        if (re.match('.+@\w+', email) is None):
            egroup_logger.debug("asyncAddEmailMember(" + email + "): not an email address adding @you.com")
            email += "@you.com"
        if "Members" in self.egroup:
            found = 0
            for index, member in enumerate(self.egroup.Members):
                if (member['Email'].lower() == email):
                    found = 1
            if (found == 0):
                self.egroup.Members.append({'Email': email, 'Type': "External"})
                self.dirty = 1
        else:
            self.egroup.Members = [{'Email': email, 'Type': "External"}]
            self.dirty = 1


    # remove egroup members by email
    def syncRemoveEmailMembers(self, emails):
        emailsToRemove = []
        for email in emails:
            email = email.lower()
            if (re.match('.+@\w+', email) is None):
                egroup_logger.debug("synchRemoveEmailMembers(" + email + "): not an email address adding @you.com")
                email += "@you.com"
            emailsToRemove.append(email)
        return self.RemoveEgroupEmailMembers(self.egroup.Name, emailsToRemove)


    # remove egroup member by email
    def asyncRemoveEmailMember(self, email):
        email = email.lower()
        if "Members" in self.egroup:
             found = 0
             for index, member in enumerate(self.egroup.Members):
                 if (member['Email'].lower() == email):
                     self.egroup.Members.remove(member)
                     self.dirty = 1
                     found = 1
             if (found == 0):
                 egroup_logger.warning("removeEgroupEmailMembers (" + email + "): no such member found in group")
        else:
             egroup_logger.warning("removeEgroupEmailMembers (" + email + "): group contains no member")
