require.config({
    paths: {
        "app": "../app"
    }
});
require([
    'splunkjs/mvc/utils',
    'splunkjs/mvc/simplexml/ready!'
], function(utils){
    require(['splunkjs/ready!'], function(){
        // The splunkjs/ready loader script will automatically instantiate all elements
        // declared in the dashboard's HTML.

        // Add active class to btn-pills that link to the current page
        $('.btn-pill').each(function() {
            if (utils.getPageInfo().page == this.pathname.split('/').pop()) {
                $(this).addClass('active');
            }
        });
    });

});require([
    'underscore',
    'jquery',
    'splunkjs/mvc',
    'splunkjs/mvc/utils',
    'splunkjs/mvc/tableview',
    'splunkjs/mvc/simplexml/ready!'
], function(_, $, mvc, utils, TableView) {

    // Translations from rangemap results to CSS class
    var ICONS = {
        severe: 'alert-circle',
        elevated: 'alert',
        low: 'check-circle'
    };

    function addRenderer(item, cells, template, classes) {
        var i = mvc.Components.get(item);
        if (i) {
            var r = TableView.BaseCellRenderer.extend({
                canRender: function(cell) {
                    for(var c in cells) {
                        if(RegExp(c).test(cell.field)) {
                            return true;
                        }
                    }
                    return false;
                },
                render: function($td, cell) {
                    for(var c in cells) {
                        if(RegExp(c).test(cell.field)) {
                            var icon = cells[c](cell.value);
                            break;
                        }
                    }

                    // Create the icon element and add it to the table cell
                    $td.addClass(classes).html(_.template(template, {
                        icon: icon,
                        text: cell.value
                    }));
                }
            });

            i.getVisualization(function(tableView){
                tableView.table.addCellRenderer(new r());
                tableView.table.render();
            });
        }
    }

    function inlineRenderer(item, cells) {
        addRenderer(item, cells, '<%- text %> <i class="icon-<%-icon%>"></i>', 'icon-inline numeric');
    }
    function rangeRenderer(item, cells) {
        addRenderer(item, cells, '<i class="icon-<%-icon%> <%- text %>" title="<%- text %>"></i>', 'icon');
    }


    /* Modify sizes of cells in a page */
    function cellWidth(page, widths) {
        if (utils.getPageInfo().page == page) {
            for (var r = 0; r < widths.length; r++) {
                var cells = $($('.dashboard-row')[r]).children('.dashboard-cell');

                for (var c = 0; c < widths[r].length; c++) {
                    $(cells[c]).css('width', widths[r][c] + '%');
                }
            }
        }
    }



    /* TSM Library Managers in Panoramix */
    inlineRenderer('table_tsm_lm', {
        '^up$'                  : function(v) { return (v != 'yes')         ? ICONS['severe']: ''; },
        'Days since last Backup': function(v) { return (parseFloat(v) > 1)  ? ICONS['severe']: ''; },
        'BackupPool %'          : function(v) { return (parseFloat(v) > 99) ? ICONS['severe']: ''; },
        '# Mounts/24h'          : function(v) { return (parseFloat(v) < 1)  ? ICONS['severe']: ''; },
    });
    rangeRenderer('table_tsm_lm', { 'Status': function(v) { return (v in ICONS)? ICONS[v]: 'question'; }});


    /* TSM Servers in Panoramix */
    inlineRenderer('table_tsm_ser', {
        '^up$'                  : function(v) { return (v != 'yes')         ? ICONS['severe']: ''; },
        'Days since last Backup': function(v) { return (parseFloat(v) > 1)  ? ICONS['severe']: ''; },
        'BackupPool %'          : function(v) { return (parseFloat(v) > 60) ? ICONS['severe']: ''; },
        '# Mounts/24h'          : function(v) { return (parseFloat(v) < 1)  ? ICONS['severe']: ''; },
    });
    rangeRenderer('table_tsm_ser', { 'Status': function(v) { return (v in ICONS)? ICONS[v]: 'question'; }});


    /* Path Information in drive_debug */
    inlineRenderer('table_path', {
        'ONLINE'      : function(v) { return (v != 'YES')? ICONS['severe']: ''; },
        'LIBRARY_NAME': function(v) { return (['TSMLIB0', 'IBMLIB2', 'TSMLIB2'].indexOf(v) == -1)? ICONS['severe']: ''; },
        'DEVICE'      : function(v) { return (v.toLowerCase() != v)? ICONS['severe']: ''; },
    });


    /* Drive Status in Asuranceturix */
    addRenderer('drive_status_lib0', {
        'Used by'     : function(v) { return (v && v.substring(0,3) == '** ')? ICONS['severe']: ''; },
    }, '<%- text %> <i class="icon-<%-icon%>"></i>', 'icon-inline');
    addRenderer('drive_status_lib2', {
        'Used by'     : function(v) { return (v && v.substring(0,3) == '** ')? ICONS['severe']: ''; },
    }, '<%- text %> <i class="icon-<%-icon%>"></i>', 'icon-inline');


    /* Latest Events by Index in Vitalstatistix */
    addRenderer('druid_health_latest', {
        'lemon'    : function(v) { return (v == '' || Date.now() > Date.parse(v) + 10*60*1000)? ICONS['severe']: ''; },
        'tsm-accnt': function(v) { return ''; },
        'tsmdb'    : function(v) { return (v == '' || Date.now() > Date.parse(v) + 10*60*1000)? ICONS['severe']: ''; },
        'tsmlogs'  : function(v) { return (v == '' || Date.now() > Date.parse(v) + 10*60*1000)? ICONS['severe']: ''; },
    }, '<i class="icon-<%-icon%>"></i> <%- text %>', 'icon-inline numeric');
    /* Real-time events in Vitalstatistix */
    addRenderer('druid_health_realtime', {
        'Latest event'    : function(v) { return (v == '' || Date.now() > Date.parse(v) + 6*60*1000)? ICONS['severe']: ''; },
    }, '<i class="icon-<%-icon%>"></i> <%- text %>', 'icon-inline numeric');
    /* Latest TSMDB Events by Type and Host in Vitalstatistix */
    addRenderer('druid_health_lastsourcetype', {
        'TSM'      : function(v) {
                         var freq = v.split(':')[0];
                         var v = v.split(':')[1];
                         if ( v == '' ) {
                             return '';
                         }

                         var icon = '';
                         var TIME = {'FIVELY': 10*60, 'HOURLY': 75*60, 'DAILY': 24*60*60 };
                         var now = Date.now();
                         if (now > (parseInt(v) + TIME[freq])*1000) {
                             icon = '<i class="icon-' + ICONS['severe'] + '"></i> ';
                         }
                         var t = new Date(v*1000);
                         now = new Date(now);
                         if (t.getYear() != now.getYear() || t.getMonth() != now.getMonth() || t.getDate() != now.getDate()) {
                             // Only show the date if it's not today
                             return icon + t.strftime('%Y-%m-%d %H:%M:%S');
                         }
                         return icon + t.strftime('%H:%M:%S');
                     },
    }, '<%=icon%>', 'icon-inline numeric');


    /* DNS Status in externals */
    addRenderer('dns_status', {
        'Last Update'    : function(v) { return (v == '' || Date.now() > Date.parse(v) + 24*60*60*1000)? ICONS['severe']: ''; },
    }, '<i class="icon-<%-icon%>"></i> <%- text %>', 'icon-inline numeric');
    inlineRenderer('dns_status', {
        'Nodes in DNS'   : function(v) { return (parseFloat(v) < 1) ? ICONS['severe']: ''; },
        'Nodes in TSMDB' : function(v) { return (parseFloat(v) < 1) ? ICONS['severe']: ''; },
        'Correct?'       : function(v) { return (v != 'yes')        ? ICONS['severe']: ''; },
    });

    /* E-group Status in externals */
    inlineRenderer('egroup_status', {
        'Members in e-group' : function(v) { return (parseFloat(v) < 1) ? ICONS['severe']: ''; },
        'Contacts in TSMDB'  : function(v) { return (parseFloat(v) < 1) ? ICONS['severe']: ''; },
        'Correct?'           : function(v) { return (v != 'yes')        ? ICONS['severe']: ''; },
    });

    /* SLS Data Status in externals */
    addRenderer('sls_status', {
        'Last sls-status update'     : function(v) { return (v == '' || Date.now() > Date.parse(v) +    10*60*1000)? ICONS['severe']: ''; },
        'Last sls-accounting update' : function(v) { return (v == '' || Date.now() > Date.parse(v) + 24*60*60*1000)? ICONS['severe']: ''; },
    }, '<i class="icon-<%-icon%>"></i> <%- text %>', 'icon-inline numeric');


    /* Total Data page */
    cellWidth('total_data', [ [],
                        [75, 25],
                      ]);


    function setToken(name, value) {
        console.log('Setting Token %o=%o', name, value);
        var defaultTokenModel = mvc.Components.get('default');
        if (defaultTokenModel) {
            defaultTokenModel.set(name, value);
        }
        var submittedTokenModel = mvc.Components.get('submitted');
        if (submittedTokenModel) {
            submittedTokenModel.set(name, value);
        }
    }

    $('.dashboard-body').on('click', '[data-set-token],[data-unset-token],[data-token-json]', function(e) {
        e.preventDefault();
        var target = $(e.currentTarget);
        var setTokenName = target.data('set-token');
        if (setTokenName) {
            setToken(setTokenName, target.data('value'));
        }
        var unsetTokenName = target.data('unset-token');
        if (unsetTokenName) {
            setToken(unsetTokenName, undefined);
        }
        var tokenJson = target.data('token-json');
        if (tokenJson) {
            try {
                if (_.isObject(tokenJson)) {
                    _(tokenJson).each(function(value, key) {
                        if (value == null) {
                            // Unset the token
                            setToken(key, undefined);
                        } else {
                            setToken(key, value);
                        }
                     });
                 }
             } catch (e) {
                 console.warn('Cannot parse token JSON: ', e);
             }
         }
    });

    $('.dashboard-body div[data-set-token],div[data-unset-token],div[data-token-json]').each(function() {
        var setTokenName = $(this).data('set-token');
        if (setTokenName) {
            setToken(setTokenName, $(this).data('value'));
        }
        var unsetTokenName = $(this).data('unset-token');
        if (unsetTokenName) {
            setToken(unsetTokenName, undefined);
        }
        var tokenJson = $(this).data('token-json');
        if (tokenJson) {
            try {
                if (_.isObject(tokenJson)) {
                    _(tokenJson).each(function(value, key) {
                        if (value == null) {
                            // Unset the token
                            setToken(key, undefined);
                        } else {
                            setToken(key, value);
                        }
                     });
                 }
             } catch (e) {
                 console.warn('Cannot parse token JSON: ', e);
             }
         }
    });

});
