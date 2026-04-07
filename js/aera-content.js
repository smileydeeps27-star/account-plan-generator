/* ===== Account Plan Generator — Aera Content Integration ===== */

AP.AeraContent = (function() {

  function load() {
    return fetch('/data/aera-content.json')
      .then(function(resp) {
        if (!resp.ok) throw new Error('Failed to load aera-content.json');
        return resp.json();
      })
      .then(function(data) {
        AP.AppStore.set('aeraContent', data);
        return data;
      })
      .catch(function(err) {
        console.warn('[AeraContent] Could not load content:', err.message);
        return null;
      });
  }

  function get() {
    return AP.AppStore.get('aeraContent') || null;
  }

  function getContextString() {
    var data = get();
    if (!data) return '';

    var lines = [];
    lines.push('--- AERA TECHNOLOGY CONTENT & EVENTS ---');
    lines.push('');

    // Events
    if (data.events && data.events.length > 0) {
      lines.push('UPCOMING EVENTS:');
      data.events.forEach(function(ev, i) {
        lines.push((i + 1) + '. ' + ev.title + ' — ' + ev.date + ', ' + ev.location + ' — ' + ev.url);
      });
      lines.push('');
    }

    // Analyst Recognition
    if (data.analystRecognition && data.analystRecognition.length > 0) {
      lines.push('ANALYST RECOGNITION:');
      data.analystRecognition.forEach(function(ar) {
        lines.push('- ' + ar.title + ' (' + ar.date + ') — ' + ar.url);
      });
      lines.push('');
    }

    // Customer Stories
    if (data.customerStories && data.customerStories.length > 0) {
      lines.push('CUSTOMER SUCCESS STORIES:');
      data.customerStories.forEach(function(cs) {
        lines.push('- ' + cs.customer + ': ' + cs.title + ' — ' + cs.useCase + ' — ' + cs.url);
      });
      lines.push('');
    }

    // Whitepapers
    if (data.whitepapers && data.whitepapers.length > 0) {
      lines.push('WHITEPAPERS:');
      data.whitepapers.forEach(function(wp) {
        lines.push('- ' + wp.title + ' (Industries: ' + wp.industries.join(', ') + ') — ' + wp.url);
      });
      lines.push('');
    }

    // Blogs
    if (data.blogs && data.blogs.length > 0) {
      lines.push('LATEST BLOGS:');
      data.blogs.forEach(function(b) {
        lines.push('- ' + b.title + ' (' + b.date + ') — ' + b.url);
      });
      lines.push('');
    }

    // Demo
    if (data.demo) {
      lines.push('DEMO: Schedule at ' + data.demo.url);
    }

    lines.push('---');
    return lines.join('\n');
  }

  function getRelevantContent(industry, topics) {
    var data = get();
    if (!data) return '';

    var industryLower = (industry || '').toLowerCase();
    var topicsLower = (topics || []).map(function(t) { return t.toLowerCase(); });

    function matchesIndustryOrTopics(industries, itemTopics) {
      var i;
      if (industries) {
        for (i = 0; i < industries.length; i++) {
          if (industries[i].toLowerCase().indexOf(industryLower) !== -1 ||
              industryLower.indexOf(industries[i].toLowerCase()) !== -1) {
            return true;
          }
        }
      }
      if (itemTopics && topicsLower.length > 0) {
        for (i = 0; i < itemTopics.length; i++) {
          var itemTopicLower = itemTopics[i].toLowerCase();
          for (var j = 0; j < topicsLower.length; j++) {
            if (itemTopicLower.indexOf(topicsLower[j]) !== -1 ||
                topicsLower[j].indexOf(itemTopicLower) !== -1) {
              return true;
            }
          }
        }
      }
      // Cross-Industry always matches
      if (industries) {
        for (i = 0; i < industries.length; i++) {
          if (industries[i] === 'Cross-Industry') return true;
        }
      }
      return false;
    }

    var lines = [];
    lines.push('--- RELEVANT AERA CONTENT ---');
    lines.push('');

    // Events — all upcoming, sorted by date (they are already chronological in the data)
    if (data.events && data.events.length > 0) {
      lines.push('UPCOMING EVENTS:');
      data.events.forEach(function(ev, i) {
        lines.push((i + 1) + '. ' + ev.title + ' — ' + ev.date + ', ' + ev.location + ' — ' + ev.url);
      });
      lines.push('');
    }

    // Analyst Recognition — all
    if (data.analystRecognition && data.analystRecognition.length > 0) {
      lines.push('ANALYST RECOGNITION:');
      data.analystRecognition.forEach(function(ar) {
        lines.push('- ' + ar.title + ' (' + ar.date + ') — ' + ar.url);
      });
      lines.push('');
    }

    // Customer Stories — all
    if (data.customerStories && data.customerStories.length > 0) {
      lines.push('CUSTOMER SUCCESS STORIES:');
      data.customerStories.forEach(function(cs) {
        lines.push('- ' + cs.customer + ': ' + cs.title + ' — ' + cs.useCase + ' — ' + cs.url);
      });
      lines.push('');
    }

    // Whitepapers — filtered
    if (data.whitepapers && data.whitepapers.length > 0) {
      var filteredWP = data.whitepapers.filter(function(wp) {
        return matchesIndustryOrTopics(wp.industries, wp.topics);
      });
      if (filteredWP.length > 0) {
        lines.push('WHITEPAPERS:');
        filteredWP.forEach(function(wp) {
          lines.push('- ' + wp.title + ' (Industries: ' + wp.industries.join(', ') + ') — ' + wp.url);
        });
        lines.push('');
      }
    }

    // Blogs — filtered
    if (data.blogs && data.blogs.length > 0) {
      var filteredBlogs = data.blogs.filter(function(b) {
        return matchesIndustryOrTopics(null, b.topics);
      });
      if (filteredBlogs.length > 0) {
        lines.push('LATEST BLOGS:');
        filteredBlogs.forEach(function(b) {
          lines.push('- ' + b.title + ' (' + b.date + ') — ' + b.url);
        });
        lines.push('');
      }
    }

    // Demo
    if (data.demo) {
      lines.push('DEMO: Schedule at ' + data.demo.url);
    }

    lines.push('---');
    return lines.join('\n');
  }

  return {
    load: load,
    get: get,
    getContextString: getContextString,
    getRelevantContent: getRelevantContent
  };

})();
