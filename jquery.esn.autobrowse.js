/**
 * Written by Micael Sjölund, ESN (http://www.esn.me)
 *
 * Creates a growing container that automatically fills its content via ajax requests, when the user scrolls to the
 * bottom of the container. More info: http://pushingtheweb.com/2010/09/endless-scroller-jquery-plugin/
 *
 * Requires jStorage (), if the useCache option is set to true. WARNING: Somewhat experimental. See below for more info.
 *
 * @param options   Options that can be submitted to the plugin
 *
 * * REQUIRED OPTIONS
 * * urlBuilder     Callback to render url from offset and count arguments.
 *                  Example: function (offset, count) { return "http://baseurl/OFFSET/COUNT".replace(/OFFSET/, offset).replace(/COUNT/, count) }
 * * template       Callback to render markup from json response.
 *                  Example: function (response) { var markup=''; for (var i=0; i<response.length; i++) { markup+='<img src="'+response[i]+'" />' } return markup; }
 * * offset         Offset for first ajax call to url.
 * * count          Number of items to fetch.
 * * totalCount     Total number of items on server.
 * * itemsReturned  Callback that is run on ajax json response to determine how many items was returned
 *
 * * OPTIONAL OPTIONS
 * * loader         Element, jQuery object or markup to represent loader.
 * * onComplete     (optional) Callback that is run when the element has been updated with new content. This is run before the
 *                  response is stored (if using useCache), so it is possible to manipulate the response here before
 *                  it is stored.
 * * useCache       If true, the plugin will use browser storage to keep the state between page loads. If the user
 *                  clicks away from the page and then goes back, all items fetched will be rendered again, and the
 *                  user will see the same view as when he left the page. Requires http://www.jstorage.info/.
 *                  WARNING: This doesn't work with original jStorage. A modified version is
 *                  available on http://github.com/msjolund/jquery-esn-autobrowse. jStorage also
 *                  requires jquery-json: http://code.google.com/p/jquery-json/.
 *
 *
 *
 */
(function( $ ){
jQuery.fn.autobrowse = function (options)
{
    var defaults = {
        urlBuilder: function (offset, count) { return "/"; },
        template: function (response) { return ""; },
        offset: 0,
        count: 20,
        totalCount: 0,
        loader: '<div class="loader"></div>',
        itemsReturned: null,
        onComplete: function (response) {},
        useCache: false
    };

    options = jQuery.extend(defaults, options);

    var getDataLength = function (data)
    {
        var length = 0
        for (var i = 0; i < data.length; i++)
            length += options.itemsReturned(data[i]);
        return length;
    };


    return this.each( function ()
    {
        var localData, obj = jQuery(this);
        var currentOffset = options.offset;
        var loading = false;
        var scrollTopUpdateTimer = null;

        var scrollCallback = function ()
        {
            var scrollTop = jQuery(window).scrollTop();
            var objBottom = obj.height() + obj.offset().top;
            var winHeight = window.innerHeight ? window.innerHeight : $(window).height();
            var winBtmPos = scrollTop + winHeight;
            if (scrollTopUpdateTimer)
                clearTimeout(scrollTopUpdateTimer);
            scrollTopUpdateTimer = setTimeout(function () { jQuery.jStorage.set("autobrowseScrollTop", scrollTop); }, 200);
            if (objBottom < winBtmPos && !loading && currentOffset <= options.totalCount)
            {
                var loader = jQuery(options.loader);
                loader.appendTo(obj);
                loading = true;
                jQuery.getJSON(options.urlBuilder(currentOffset, options.count), function (response) {
                    // Check if this was the last items to fetch from the server, if so, stop listening
                    if (options.itemsReturned(response) + currentOffset >= options.totalCount || options.itemsReturned(response) == 0)
                    {
                        jQuery(window).unbind("scroll", scrollCallback);
                    }

                    if (options.itemsReturned(response) > 0)
                    {
                        // Create the markup and append it to the container
                        try { var markup = options.template(response); }
                        catch (e) { } // ignore for now
                        jQuery(markup).appendTo(obj);

                        // Call user onComplete callback
                        options.onComplete.call(obj, response);

                        // Store in local cache if option is set, and everything fetched fitted into the storage
                        if (options.useCache && getDataLength(localData) + options.offset == currentOffset)
                        {
                            localData.push(response);
                            if (!jQuery.jStorage.set("autobrowseStorage", localData))
                                // Storage failed, remove last pushed response
                                localData.pop();
                        }

                        // Update offsets
                        currentOffset += options.itemsReturned(response);
                        if (options.useCache)
                        {
                            jQuery.jStorage.set("autobrowseOffset", currentOffset);
                        }
                    }

                    loader.remove();
                    loading = false;
                });
            }
        };

        var startPlugin = function()
        {
            if (options.useCache)
                var autobrowseScrollTop = jQuery.jStorage.get("autobrowseScrollTop");
            if (autobrowseScrollTop)
                jQuery(window).scrollTop(autobrowseScrollTop);
            jQuery(window).scroll(scrollCallback);
            scrollCallback();
        };


        if (options.useCache)
        {
            if (jQuery.jStorage.get("autobrowseStorageKey") != options.urlBuilder(0,0))
            {
                jQuery.jStorage.flush();
            }
            localData= jQuery.jStorage.get("autobrowseStorage");
            if (localData)
            {
                // for each stored ajax response
                for (var i = 0; i < localData.length; i++)
                {
                    var markup = options.template(localData[i]);
                    jQuery(markup).appendTo(obj);
                    currentOffset += options.itemsReturned(localData[i]);
                    options.onComplete.call(obj, localData[i]);
                }
                var offsetDifference = jQuery.jStorage.get("autobrowseOffset") - currentOffset;
                if (offsetDifference > 0)
                {
                    // Storage didn't contain enough items, need to fetch them via ajax
                    var loader = jQuery(options.loader);
                    loader.appendTo(obj);
                    loading = true;
                    jQuery.getJSON(options.urlBuilder(currentOffset, offsetDifference), function (response) {
                        // Create the markup and append it to the container
                        try { var markup = options.template(response); }
                        catch (e) { } // ignore for now
                        jQuery(markup).appendTo(obj);
                        // Call user onComplete callback
                        options.onComplete.call(obj, response);
                        currentOffset += options.itemsReturned(response);
                        loader.remove();
                        loading = false;
                        startPlugin();
                    });
                }
                else
                {
                    startPlugin();
                }
            }
            else
            {
                localData = [];
                jQuery.jStorage.set("autobrowseOffset", currentOffset);
                jQuery.jStorage.set("autobrowseStorageKey", options.urlBuilder(0, 0));
                jQuery.jStorage.set("autobrowseStorage", localData);
                jQuery.jStorage.set("autobrowseScrollTop", 0);
                startPlugin();
            }
        }

        else
        {
            startPlugin();
        }
    });
};
})( jQuery );