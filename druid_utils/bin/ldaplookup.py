# An adapter that takes CSV as input, performs a lookup to some external system, then returns the CSV results
import csv,sys
import ldap

l = ldap.initialize('ldap://ldap.you.com')

#managed = {}

def getShortCN(CN):
    return CN.split(',')[0].split('=')[1]

# Given a contact, find the users
def lookup(contact):
    members = []

    email = contact
    if email.find('@') == -1:
        email += '@*you.com'
    else:
        email += '*'

    mm= l.search_s('DC=you,DC=com', ldap.SCOPE_SUBTREE, '(&(!(|(employeeType=External)(employeeType=Ex)(objectClass=computer)))(|(proxyAddresses=smtp:%s)(CN=%s)))' % (email, contact), ['cn', 'objectClass', 'employeeType', 'member', 'seeAlso']) #, 'managedBy'])

    for name, values in mm:
        if 'group' in values['objectClass']:
            # It's an e-group
            #manager = getShortCN(values['managedBy'][0])
            #managed[contact.lower()] = userInfo(manager)
            for m in values['member']:
                if m.endswith('OU=Externals,DC=you,DC=com'):
                    # Don't bother looking up externals
                    continue
                members.extend(lookup(getShortCN(m)))
        elif 'Service' in values['employeeType']:
            # It's a service account, resolve the owner (aka. seeAlso)
            for m in values['seeAlso']:
                # Just in case there are several seeAlso's
                # Lets do another lookup, in case they allow e-groups to own service accounts
                members.extend(lookup(getShortCN(m)))
                #managed[contact.lower()] = userInfo(getShortCN(m))
        else:
            # Must be a person, then
            members.extend(values['cn'])
            #managed[contact.lower()] = userInfo(values['cn'][0])

    # remove duplicates before returning the list
    return list(set(members))

def userInfo(cn):
    mm= l.search_s('DC=you,DC=com', ldap.SCOPE_SUBTREE, '(&(!(|(employeeType=External)(employeeType=Ex)(objectClass=computer)))(cn=%s))' % cn, ['cn', 'division', 'extensionAttribute13', 'displayName'])

    name, values = mm[0]
    return {
        'cn': values.get('cn', [None])[0],
        'name': values.get('displayName', [None])[0],
        'department': values.get('division', [None])[0],
        'group': values.get('extensionAttribute13', [None])[0],
    }

def main():
    contactf = 'contact'
    usernamef = 'username'
    r = csv.reader(sys.stdin)
    w = None
    header = []
    first = True

    for line in r:
        if first:
            header = line
            if contactf not in header and usernamef not in header:
                print "Contact or username fields must exist in CSV data"
                sys.exit(0)
            csv.writer(sys.stdout).writerow(header)
            w = csv.DictWriter(sys.stdout, header)
            first = False
            continue

        # Read the result
        result = {}
        i = 0
        while i < len(header):
            if i < len(line):
                result[header[i]] = line[i]
            else:
                result[header[i]] = ''
            i += 1

        # Perform the lookup
        if (contactf in header and len(result[contactf])) and (usernamef in header and len(result[usernamef])):
            w.writerow(result)

        elif contactf in header and len(result[contactf]):
            unames = lookup(result[contactf])
            for uname in unames:
                result[usernamef] = uname
                #result['department'] = managed[result[contactf].lower()]['department']
                #result['group'] = managed[result[contactf].lower()]['group']
                w.writerow(result)

        elif usernamef in header and len(result[usernamef]):
            info = userInfo(result[usernamef])
            result['name'] = info['name']
            result['department'] = info['department']
            result['group'] = info['group']
            w.writerow(result)


main()
