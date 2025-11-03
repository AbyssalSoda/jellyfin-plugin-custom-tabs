using System;
using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.CustomTabs.Configuration
{
    public class PluginConfiguration : BasePluginConfiguration
    {
        public TabConfig[] Tabs { get; set; } = Array.Empty<TabConfig>();
    }

    public class TabConfig
    {
        public string ContentHtml { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;

        public string? RedirectUrl { get; set; } = null;

        public bool IsExternal { get; set; } = false;

        public string? Target { get; set; } = null;
    }
}
