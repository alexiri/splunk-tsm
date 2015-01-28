SPECFILE    = $(shell find -maxdepth 1 -type f -name *.spec)
PACKAGE     = $(shell awk '$$1 == "Name:"     { print $$2 }' $(SPECFILE) )
VERSION     = $(shell awk '$$1 == "Version:"  { print $$2 }' $(SPECFILE) )
RELEASE     = $(shell awk '$$1 == "Release:"  { print $$2 }' $(SPECFILE) )
TARNAME     = $(PACKAGE)-$(VERSION).tar.gz

# ------------------------------------------

clean:
	@rm -f $(TARNAME)

tar: clean
	@mkdir -p $(PACKAGE)-$(VERSION)/
	@cp tsmsyslogger.* $(PACKAGE)-$(VERSION)/
	@rm -f $(PACKAGE)-$(VERSION)/tsmsyslogger.spec

	@tar cpzf $(TARNAME) --exclude 'CVS' --exclude 'test_*' $(PACKAGE)-$(VERSION) $(SPECFILE)

	@rm -rf $(PACKAGE)-$(VERSION)

rpm: tar
	@rpmbuild -ta $(TARNAME)
	@rm -f $(TARNAME)
