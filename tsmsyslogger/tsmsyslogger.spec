#
# File		$Id: tsmsyslogger.spec,v 1.4 2010/05/12 14:50:51 airibarr Exp $
#
# Purpose	TSM interface to syslog
#
# History
#		$Log: tsmsyslogger.spec,v $
#		Revision 1.4  2010/05/12 14:50:51  airibarr
#		Fixed permissions for TSM6
#
#		Revision 1.3  2009/11/25 11:08:21  airibarr
#		Remove dependency on TSM RPM
#
#		Revision 1.2  2009/11/23 16:07:56  airibarr
#		Updated tsmsyslogger.h to version shipped with TSM6
#
#		Revision 1.1  2009/08/04 14:32:47  airibarr
#		Initial commit
#
#
Summary: TSM interface to syslog
Name: CERN-CC-tsmsyslogger
Version: 1.0
Release: 4%{?dist}
License: GPL
Group: System Environment/Base
Buildroot: %{_tmppath}/%{name}-%{version}
Source: %{name}-%{version}.tar.gz
Summary: TSM interface to syslog

%define debug_package %{nil}

%description
Provides TSM userexit function that acts as an interface to syslog

%prep
%setup -n %{name}-%{version}

%build
gcc -g -D_REENTRANT -D__linux -O0 -Wall -DHAVE_DAEMON -DHAVE_SYSLOG_NAMES -DHAVE_GETOPT_H -D_GNU_SOURCE -fPIC -I/opt/tivoli/tsm/server/bin -c -o tsmsyslogger.o tsmsyslogger.c
ld -o tsmsyslogger.so -shared -E tsmsyslogger.o

%install
rm -rf %buildroot/

mkdir -p %buildroot/opt/tivoli/tsm/server/bin/

install -m 555 tsmsyslogger.so %buildroot/opt/tivoli/tsm/server/bin/tsmsyslogger.so


%clean
rm -rf %buildroot

%files
%defattr(-,root,root)
/opt/tivoli/tsm/server/bin/tsmsyslogger.so

%post
%preun
