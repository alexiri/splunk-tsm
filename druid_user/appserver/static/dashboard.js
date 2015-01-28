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

    /* Editable tables */
    var edittables = ['nodeinfo_edit'];
    require(['app/edittable/edittable'], function() {
        $.each(edittables, function(i, t) {
            if ($('#'+t).length) {
                $(this).editTable(t);
            }
        });
    });

});
