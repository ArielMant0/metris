const tabManager = (function() {

    const tabs = new Map();
    const active = null;

    return  {

        addTab: function(tab) {
            tabs.set(tab.id, tab);
            $("#nav-list").append(`<li>
                <a id="get-${tab.id}" href="#">${tab.id}</a></li>`
            );
        },

        switchTab: function(tabid, force=false) {
            if (active) {
                active.unload();
            }
            active = this.tabs.get(tabid);
            active.load(force);
        },

        switchTabData: function(tabid, data) {
            if (active) {
                active.unload();
            }
            active = this.tabs.get(tabid);
            active.load(data, true);
        }
    };

}());
