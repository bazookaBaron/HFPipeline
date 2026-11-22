/*
 * HFProps -- shared prop-merge/defaults system.
 *
 * The rule this exists to enforce (a real production bug in the old
 * pipeline, see PLAN.md): a component must never silently mix authored
 * fields with dropped/placeholder ones. If props arrive partially missing
 * or malformed, EVERY field is resolved through the same coercion policy,
 * independently, against ITS OWN declared default -- never "field A used
 * as authored, field B silently blanked, field C fell back to a hardcoded
 * placeholder string nobody asked for." One policy, applied uniformly,
 * every time, to every field.
 *
 * Every component's script must read variables ONLY through
 * HFProps.resolve(vars, SCHEMA) -- never destructure `window.__hyperframes
 * .getVariables()` (or data-variable-values) directly. That is the
 * enforcement mechanism: there is no code path in a compliant component
 * that reads a raw, unvalidated value.
 *
 * Usage:
 *   var SCHEMA = {
 *     title:  { type: "string", default: "Untitled", maxLength: 60 },
 *     count:  { type: "number", default: 3, min: 0, max: 9 },
 *     accent: { type: "enum",   default: "brand", options: ["brand","accent","accent-2"] },
 *     items:  { type: "list",   default: ["One", "Two", "Three"], max: 8 },
 *   };
 *   var vars = window.__hyperframes && window.__hyperframes.getVariables
 *     ? window.__hyperframes.getVariables() : {};
 *   var props = HFProps.resolve(vars, SCHEMA);
 */
(function (global) {
  "use strict";

  function isNonEmptyString(v) {
    return typeof v === "string" && v.trim().length > 0;
  }

  function coerce(raw, spec) {
    switch (spec.type) {
      case "string": {
        if (!isNonEmptyString(raw)) return spec.default;
        var s = raw.trim();
        return spec.maxLength ? s.slice(0, spec.maxLength) : s;
      }
      case "number": {
        var n = typeof raw === "number" ? raw : parseFloat(raw);
        if (!isFinite(n)) return spec.default;
        var min = spec.min == null ? -Infinity : spec.min;
        var max = spec.max == null ? Infinity : spec.max;
        return Math.min(max, Math.max(min, n));
      }
      case "boolean": {
        if (typeof raw === "boolean") return raw;
        if (raw === "true") return true;
        if (raw === "false") return false;
        return spec.default;
      }
      case "color": {
        if (isNonEmptyString(raw) && /^(#|rgb|hsl|var\()/i.test(raw.trim())) return raw.trim();
        return spec.default;
      }
      case "enum": {
        var options = spec.options || [];
        return options.indexOf(raw) !== -1 ? raw : spec.default;
      }
      case "list": {
        // Accepts a real array, a JSON array string, or a delimiter-joined
        // string (default delimiter "|" to match the registry convention
        // seen in chat-thread's `messages` variable).
        var arr = null;
        if (Array.isArray(raw)) {
          arr = raw;
        } else if (isNonEmptyString(raw)) {
          var trimmed = raw.trim();
          if (trimmed.charAt(0) === "[") {
            try {
              var parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) arr = parsed;
            } catch (e) {
              arr = null;
            }
          }
          if (!arr) {
            arr = trimmed
              .split(spec.delimiter || "|")
              .map(function (s) {
                return s.trim();
              })
              .filter(Boolean);
          }
        }
        if (!arr || arr.length === 0) return spec.default.slice();
        if (spec.max) arr = arr.slice(0, spec.max);
        return arr;
      }
      default:
        return raw == null ? spec.default : raw;
    }
  }

  /**
   * Resolve every key in `schema` against `vars`, independently, always
   * falling back to that key's own default. Returns a plain object with
   * every schema key present (never a partial object).
   */
  function resolve(vars, schema) {
    var out = {};
    vars = vars || {};
    for (var key in schema) {
      if (!Object.prototype.hasOwnProperty.call(schema, key)) continue;
      out[key] = coerce(vars[key], schema[key]);
    }
    return out;
  }

  /**
   * Multi-phase / multi-step content helper: clears a container's children
   * before the caller rebuilds it, so old-phase nodes never accumulate
   * alongside new ones (a real bug class named in PLAN.md -- "must actually
   * clear and rebuild old state, not accumulate stale elements").
   */
  function rebuild(container, buildFn) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    return buildFn(container);
  }

  global.HFProps = {
    resolve: resolve,
    coerce: coerce,
    rebuild: rebuild,
  };
})(window);
