require.config({
    paths: {
        "app": "../app"
    }
});
require([
    'jquery',
    'underscore',
    'splunkjs/mvc',
    'util/console',
    'splunkjs/mvc/utils',
    'splunkjs/mvc/simplexml/ready!'
], function($, _, mvc, console, utils){
    require(['splunkjs/ready!'], function(){
        // The splunkjs/ready loader script will automatically instantiate all elements
        // declared in the dashboard's HTML.

        // Add active class to btn-pills that link to the current page
        $('.btn-pill').each(function() {
            if (utils.getPageInfo().page == this.pathname.split('/').pop()) {
                $(this).addClass('active');
            }
        });

        // Hack to allow opening links from the nav bar in a new window
        $(".nav-item a").each(function(i, link) {
            var href = $(link).attr("href");
            if (href.indexOf("#newWindow") > 0) {
                $(link).attr("target","_blank");
                href = href.substring(0,href.indexOf("#newWindow"));
                $(link).attr("href",href);
            }
        });
    });

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

    /* Total Data page */
    cellWidth('total_data', [ [],
                        [75, 25],
                      ]);

    /* Main page */
    cellWidth('main', [ [],
                        [66.666, 33.333],
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
