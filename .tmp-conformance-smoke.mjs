// node_modules/date-fns/constants.js
var daysInYear = 365.2425;
var maxTime = Math.pow(10, 8) * 24 * 60 * 60 * 1e3;
var minTime = -maxTime;
var millisecondsInMinute = 6e4;
var millisecondsInHour = 36e5;
var secondsInHour = 3600;
var secondsInDay = secondsInHour * 24;
var secondsInWeek = secondsInDay * 7;
var secondsInYear = secondsInDay * daysInYear;
var secondsInMonth = secondsInYear / 12;
var secondsInQuarter = secondsInMonth * 3;
var constructFromSymbol = Symbol.for("constructDateFrom");

// node_modules/date-fns/constructFrom.js
function constructFrom(date, value) {
  if (typeof date === "function") return date(value);
  if (date && typeof date === "object" && constructFromSymbol in date)
    return date[constructFromSymbol](value);
  if (date instanceof Date) return new date.constructor(value);
  return new Date(value);
}

// node_modules/date-fns/toDate.js
function toDate(argument, context) {
  return constructFrom(context || argument, argument);
}

// node_modules/date-fns/isDate.js
function isDate(value) {
  return value instanceof Date || typeof value === "object" && Object.prototype.toString.call(value) === "[object Date]";
}

// node_modules/date-fns/isValid.js
function isValid(date) {
  return !(!isDate(date) && typeof date !== "number" || isNaN(+toDate(date)));
}

// node_modules/date-fns/parseISO.js
function parseISO(argument, options) {
  const invalidDate = () => constructFrom(options?.in, NaN);
  const additionalDigits = options?.additionalDigits ?? 2;
  const dateStrings = splitDateString(argument);
  let date;
  if (dateStrings.date) {
    const parseYearResult = parseYear(dateStrings.date, additionalDigits);
    date = parseDate(parseYearResult.restDateString, parseYearResult.year);
  }
  if (!date || isNaN(+date)) return invalidDate();
  const timestamp = +date;
  let time = 0;
  let offset;
  if (dateStrings.time) {
    time = parseTime(dateStrings.time);
    if (isNaN(time)) return invalidDate();
  }
  if (dateStrings.timezone) {
    offset = parseTimezone(dateStrings.timezone);
    if (isNaN(offset)) return invalidDate();
  } else {
    const tmpDate = new Date(timestamp + time);
    const result = toDate(0, options?.in);
    result.setFullYear(
      tmpDate.getUTCFullYear(),
      tmpDate.getUTCMonth(),
      tmpDate.getUTCDate()
    );
    result.setHours(
      tmpDate.getUTCHours(),
      tmpDate.getUTCMinutes(),
      tmpDate.getUTCSeconds(),
      tmpDate.getUTCMilliseconds()
    );
    return result;
  }
  return toDate(timestamp + time + offset, options?.in);
}
var patterns = {
  dateTimeDelimiter: /[T ]/,
  timeZoneDelimiter: /[Z ]/i,
  timezone: /([Z+-].*)$/
};
var dateRegex = /^-?(?:(\d{3})|(\d{2})(?:-?(\d{2}))?|W(\d{2})(?:-?(\d{1}))?|)$/;
var timeRegex = /^(\d{2}(?:[.,]\d*)?)(?::?(\d{2}(?:[.,]\d*)?))?(?::?(\d{2}(?:[.,]\d*)?))?$/;
var timezoneRegex = /^([+-])(\d{2})(?::?(\d{2}))?$/;
function splitDateString(dateString) {
  const dateStrings = {};
  const array = dateString.split(patterns.dateTimeDelimiter);
  let timeString;
  if (array.length > 2) {
    return dateStrings;
  }
  if (/:/.test(array[0])) {
    timeString = array[0];
  } else {
    dateStrings.date = array[0];
    timeString = array[1];
    if (patterns.timeZoneDelimiter.test(dateStrings.date)) {
      dateStrings.date = dateString.split(patterns.timeZoneDelimiter)[0];
      timeString = dateString.substr(
        dateStrings.date.length,
        dateString.length
      );
    }
  }
  if (timeString) {
    const token = patterns.timezone.exec(timeString);
    if (token) {
      dateStrings.time = timeString.replace(token[1], "");
      dateStrings.timezone = token[1];
    } else {
      dateStrings.time = timeString;
    }
  }
  return dateStrings;
}
function parseYear(dateString, additionalDigits) {
  const regex = new RegExp(
    "^(?:(\\d{4}|[+-]\\d{" + (4 + additionalDigits) + "})|(\\d{2}|[+-]\\d{" + (2 + additionalDigits) + "})$)"
  );
  const captures = dateString.match(regex);
  if (!captures) return { year: NaN, restDateString: "" };
  const year = captures[1] ? parseInt(captures[1]) : null;
  const century = captures[2] ? parseInt(captures[2]) : null;
  return {
    year: century === null ? year : century * 100,
    restDateString: dateString.slice((captures[1] || captures[2]).length)
  };
}
function parseDate(dateString, year) {
  if (year === null) return /* @__PURE__ */ new Date(NaN);
  const captures = dateString.match(dateRegex);
  if (!captures) return /* @__PURE__ */ new Date(NaN);
  const isWeekDate = !!captures[4];
  const dayOfYear = parseDateUnit(captures[1]);
  const month = parseDateUnit(captures[2]) - 1;
  const day = parseDateUnit(captures[3]);
  const week = parseDateUnit(captures[4]);
  const dayOfWeek = parseDateUnit(captures[5]) - 1;
  if (isWeekDate) {
    if (!validateWeekDate(year, week, dayOfWeek)) {
      return /* @__PURE__ */ new Date(NaN);
    }
    return dayOfISOWeekYear(year, week, dayOfWeek);
  } else {
    const date = /* @__PURE__ */ new Date(0);
    if (!validateDate(year, month, day) || !validateDayOfYearDate(year, dayOfYear)) {
      return /* @__PURE__ */ new Date(NaN);
    }
    date.setUTCFullYear(year, month, Math.max(dayOfYear, day));
    return date;
  }
}
function parseDateUnit(value) {
  return value ? parseInt(value) : 1;
}
function parseTime(timeString) {
  const captures = timeString.match(timeRegex);
  if (!captures) return NaN;
  const hours = parseTimeUnit(captures[1]);
  const minutes = parseTimeUnit(captures[2]);
  const seconds = parseTimeUnit(captures[3]);
  if (!validateTime(hours, minutes, seconds)) {
    return NaN;
  }
  return hours * millisecondsInHour + minutes * millisecondsInMinute + seconds * 1e3;
}
function parseTimeUnit(value) {
  return value && parseFloat(value.replace(",", ".")) || 0;
}
function parseTimezone(timezoneString) {
  if (timezoneString === "Z") return 0;
  const captures = timezoneString.match(timezoneRegex);
  if (!captures) return 0;
  const sign = captures[1] === "+" ? -1 : 1;
  const hours = parseInt(captures[2]);
  const minutes = captures[3] && parseInt(captures[3]) || 0;
  if (!validateTimezone(hours, minutes)) {
    return NaN;
  }
  return sign * (hours * millisecondsInHour + minutes * millisecondsInMinute);
}
function dayOfISOWeekYear(isoWeekYear, week, day) {
  const date = /* @__PURE__ */ new Date(0);
  date.setUTCFullYear(isoWeekYear, 0, 4);
  const fourthOfJanuaryDay = date.getUTCDay() || 7;
  const diff = (week - 1) * 7 + day + 1 - fourthOfJanuaryDay;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}
var daysInMonths = [31, null, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function isLeapYearIndex(year) {
  return year % 400 === 0 || year % 4 === 0 && year % 100 !== 0;
}
function validateDate(year, month, date) {
  return month >= 0 && month <= 11 && date >= 1 && date <= (daysInMonths[month] || (isLeapYearIndex(year) ? 29 : 28));
}
function validateDayOfYearDate(year, dayOfYear) {
  return dayOfYear >= 1 && dayOfYear <= (isLeapYearIndex(year) ? 366 : 365);
}
function validateWeekDate(_year, week, day) {
  return week >= 1 && week <= 53 && day >= 0 && day <= 6;
}
function validateTime(hours, minutes, seconds) {
  if (hours === 24) {
    return minutes === 0 && seconds === 0;
  }
  return seconds >= 0 && seconds < 60 && minutes >= 0 && minutes < 60 && hours >= 0 && hours < 25;
}
function validateTimezone(_hours, minutes) {
  return minutes >= 0 && minutes <= 59;
}

// src/utils/dateUtils.ts
function parseDate2(dateString) {
  if (!dateString) {
    const error = new Error("Date string cannot be empty");
    console.error("Date parsing error:", { dateString, error: error.message });
    throw error;
  }
  const trimmed = dateString.trim();
  try {
    const dateWithDayNameMatch = trimmed.match(
      /^(\d{4}-\d{2}-\d{2})\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i
    );
    if (dateWithDayNameMatch) {
      const dateOnly = dateWithDayNameMatch[1];
      return parseDate2(dateOnly);
    }
    if (trimmed.startsWith("T") && /^T\d{2}:\d{2}(:\d{2})?/.test(trimmed)) {
      const error = new Error(`Invalid date format - time without date: ${dateString}`);
      console.warn("Date parsing error - incomplete time format:", {
        original: dateString,
        trimmed,
        error: error.message
      });
      throw error;
    }
    if (/^\d{4}-W\d{2}$/.test(trimmed)) {
      const [year, week] = trimmed.split("-W");
      const yearNum = parseInt(year, 10);
      const weekNum = parseInt(week, 10);
      if (isNaN(yearNum) || isNaN(weekNum)) {
        const error = new Error(`Invalid numeric values in ISO week format: ${dateString}`);
        console.warn("Date parsing error - invalid ISO week numbers:", {
          original: dateString,
          year,
          week,
          yearNum,
          weekNum
        });
        throw error;
      }
      if (weekNum < 1 || weekNum > 53) {
        const error = new Error(
          `Invalid week number in ISO week format: ${dateString} (week must be 1-53)`
        );
        console.warn("Date parsing error - week number out of range:", {
          original: dateString,
          weekNum,
          error: error.message
        });
        throw error;
      }
      const jan4 = new Date(yearNum, 0, 4);
      const jan4Day = jan4.getDay();
      const mondayOfWeek1 = new Date(jan4);
      mondayOfWeek1.setDate(jan4.getDate() - (jan4Day === 0 ? 6 : jan4Day - 1));
      const targetWeekMonday = new Date(mondayOfWeek1);
      targetWeekMonday.setDate(mondayOfWeek1.getDate() + (weekNum - 1) * 7);
      if (!isValid(targetWeekMonday)) {
        const error = new Error(
          `Failed to calculate date from ISO week format: ${dateString}`
        );
        console.error("Date parsing error - ISO week calculation failed:", {
          original: dateString,
          yearNum,
          weekNum,
          jan4: jan4.toISOString(),
          targetWeekMonday: targetWeekMonday.toString()
        });
        throw error;
      }
      return targetWeekMonday;
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?/.test(trimmed)) {
      const isoFormat = trimmed.replace(" ", "T");
      const parsed = parseISO(isoFormat);
      if (!isValid(parsed)) {
        const error = new Error(`Invalid space-separated datetime: ${dateString}`);
        console.warn("Date parsing error - space-separated datetime invalid:", {
          original: dateString,
          converted: isoFormat,
          error: error.message
        });
        throw error;
      }
      return parsed;
    }
    if (trimmed.includes("T") || trimmed.includes("Z") || trimmed.match(/[+-]\d{2}:\d{2}$/)) {
      const parsed = parseISO(trimmed);
      if (!isValid(parsed)) {
        const error = new Error(`Invalid timezone-aware date: ${dateString}`);
        console.warn("Date parsing error - timezone-aware format invalid:", {
          original: dateString,
          trimmed,
          error: error.message
        });
        throw error;
      }
      return parsed;
    } else {
      const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dateMatch) {
        const error = new Error(
          `Invalid date-only string: ${dateString} (expected format: yyyy-MM-dd)`
        );
        console.warn("Date parsing error - date-only format invalid:", {
          original: dateString,
          trimmed,
          expectedFormat: "yyyy-MM-dd",
          error: error.message
        });
        throw error;
      }
      const [, year, month, day] = dateMatch;
      const parsed = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      if (!isValid(parsed) || parsed.getFullYear() !== parseInt(year, 10) || parsed.getMonth() !== parseInt(month, 10) - 1 || parsed.getDate() !== parseInt(day, 10)) {
        const error = new Error(`Invalid date values: ${dateString}`);
        console.warn("Date parsing error - invalid date values:", {
          original: dateString,
          year,
          month,
          day,
          error: error.message
        });
        throw error;
      }
      return parsed;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Invalid date")) {
      throw error;
    }
    const wrappedError = new Error(
      `Unexpected error parsing date "${dateString}": ${error instanceof Error ? error.message : String(error)}`
    );
    console.error("Unexpected date parsing error:", {
      original: dateString,
      trimmed,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : void 0
    });
    throw wrappedError;
  }
}
function parseDateToUTC(dateString) {
  if (!dateString) {
    const error = new Error("Date string cannot be empty");
    console.error("Date parsing error:", { dateString, error: error.message });
    throw error;
  }
  const trimmed = dateString.trim();
  try {
    const dateWithDayNameMatch = trimmed.match(
      /^(\d{4}-\d{2}-\d{2})\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i
    );
    if (dateWithDayNameMatch) {
      const dateOnly = dateWithDayNameMatch[1];
      return parseDateToUTC(dateOnly);
    }
    const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const yearNum = parseInt(year, 10);
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);
      if (monthNum < 1 || monthNum > 12) {
        throw new Error(`Invalid month in date: ${dateString}`);
      }
      if (dayNum < 1 || dayNum > 31) {
        throw new Error(`Invalid day in date: ${dateString}`);
      }
      const parsed = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
      if (parsed.getUTCFullYear() !== yearNum || parsed.getUTCMonth() !== monthNum - 1 || parsed.getUTCDate() !== dayNum) {
        throw new Error(`Invalid date values: ${dateString}`);
      }
      return parsed;
    }
    return parseDateToLocal(trimmed);
  } catch (error) {
    const wrappedError = new Error(`Failed to parse date to UTC: ${trimmed}`);
    console.error("Date parsing error:", {
      dateString,
      trimmed,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : void 0
    });
    throw wrappedError;
  }
}
var parseDateToLocal = parseDate2;
function isSameDateSafe(date1, date2) {
  try {
    const date1Part = getDatePart(date1);
    const date2Part = getDatePart(date2);
    const d1 = parseDateToUTC(date1Part);
    const d2 = parseDateToUTC(date2Part);
    return d1.getTime() === d2.getTime();
  } catch (error) {
    console.error("Error comparing dates:", { date1, date2, error });
    return false;
  }
}
function getDatePart(dateString) {
  if (!dateString) return "";
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    const tIndex = dateString.indexOf("T");
    if (tIndex > -1) {
      return dateString.substring(0, tIndex);
    }
    const parsed = parseDateToUTC(dateString);
    return formatDateForStorage(parsed);
  } catch (error) {
    console.error("Error extracting date part:", { dateString, error });
    return dateString;
  }
}
function validateCompleteInstances(instances) {
  if (!Array.isArray(instances)) {
    return [];
  }
  return instances.filter((instance) => {
    if (typeof instance !== "string" || !instance.trim()) {
      return false;
    }
    const trimmed = instance.trim();
    if (trimmed.startsWith("T") && /^T\d{2}:\d{2}(:\d{2})?/.test(trimmed)) {
      return false;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return false;
    }
    try {
      parseDate2(trimmed);
      return true;
    } catch (error) {
      console.warn(
        "Invalid complete_instances entry (date parsing failed):",
        instance,
        error
      );
      return false;
    }
  }).map((instance) => instance.trim());
}
function formatDateForStorage(date) {
  try {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      console.warn("formatDateForStorage received invalid date:", date);
      return "";
    }
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Error formatting date for storage:", { date, error });
    return "";
  }
}

// src/utils/dependencyUtils.ts
import { TFile as TFile2, parseLinktext as parseLinktext2 } from "obsidian";

// src/utils/linkUtils.ts
import { parseLinktext } from "obsidian";
function parseLinkToPath(linkText) {
  if (!linkText) return linkText;
  const trimmed = linkText.trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    let inner = trimmed.slice(1, -1).trim();
    const hasMdExt = /\.md$/i.test(inner);
    try {
      inner = decodeURIComponent(inner);
    } catch (error) {
      console.debug("Failed to decode URI component:", inner, error);
    }
    const parsed = parseLinktext(inner);
    return hasMdExt ? inner : parsed.path || inner;
  }
  if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
    const inner = trimmed.slice(2, -2).trim();
    const pipeIndex = inner.indexOf("|");
    const pathOnly = pipeIndex !== -1 ? inner.substring(0, pipeIndex) : inner;
    const parsed = parseLinktext(pathOnly);
    return parsed.path;
  }
  const markdownMatch = trimmed.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
  if (markdownMatch) {
    let linkPath = markdownMatch[2].trim();
    if (linkPath.startsWith("<") && linkPath.endsWith(">")) {
      linkPath = linkPath.slice(1, -1).trim();
    }
    const hasMdExt = /\.md$/i.test(linkPath);
    try {
      linkPath = decodeURIComponent(linkPath);
    } catch (error) {
      console.debug("Failed to decode URI component:", linkPath, error);
    }
    const parsed = parseLinktext(linkPath);
    return hasMdExt ? linkPath : parsed.path;
  }
  return trimmed;
}

// src/utils/dependencyUtils.ts
var DEFAULT_DEPENDENCY_RELTYPE = "FINISHTOSTART";
var VALID_RELATIONSHIP_TYPES = [
  "FINISHTOSTART",
  "FINISHTOFINISH",
  "STARTTOSTART",
  "STARTTOFINISH"
];
function isValidDependencyRelType(value) {
  return VALID_RELATIONSHIP_TYPES.includes(value);
}
function normalizeDependencyEntry(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return { uid: parseLinkToPath(trimmed), reltype: DEFAULT_DEPENDENCY_RELTYPE };
  }
  if (typeof value === "object" && value !== null) {
    const raw = value;
    const rawUid = typeof raw.uid === "string" ? raw.uid.trim() : "";
    if (!rawUid) {
      return null;
    }
    const normalizedUid = parseLinkToPath(rawUid);
    const reltypeRaw = typeof raw.reltype === "string" ? raw.reltype.trim().toUpperCase() : "";
    const reltype = isValidDependencyRelType(reltypeRaw) ? reltypeRaw : DEFAULT_DEPENDENCY_RELTYPE;
    const gap = typeof raw.gap === "string" && raw.gap.trim().length > 0 ? raw.gap.trim() : void 0;
    return gap ? { uid: normalizedUid, reltype, gap } : { uid: normalizedUid, reltype };
  }
  return null;
}
function normalizeDependencyList(value) {
  if (value === null || value === void 0) {
    return void 0;
  }
  const arrayValue = Array.isArray(value) ? value : [value];
  const normalized = [];
  for (const entry of arrayValue) {
    const normalizedEntry = normalizeDependencyEntry(entry);
    if (normalizedEntry) {
      normalized.push(normalizedEntry);
    }
  }
  return normalized.length > 0 ? normalized : void 0;
}
function serializeDependencies(dependencies) {
  return dependencies.map((dependency) => {
    const uid = dependency.uid.startsWith("[[") ? dependency.uid : `[[${dependency.uid}]]`;
    const serialized = {
      uid,
      reltype: dependency.reltype
    };
    if (dependency.gap && dependency.gap.trim().length > 0) {
      serialized.gap = dependency.gap;
    }
    return serialized;
  });
}

// src/services/FieldMapper.ts
var FieldMapper = class {
  constructor(mapping) {
    this.mapping = mapping;
  }
  /**
   * Convert internal field name to user's property name
   */
  toUserField(internalName) {
    return this.mapping[internalName];
  }
  /**
   * Normalize arbitrary title-like values to a string.
   * - string: return as-is
   * - number/boolean: String(value)
   * - array: join elements stringified with ', '
   * - object: return empty string (unsupported edge case)
   */
  normalizeTitle(val) {
    if (typeof val === "string") return val;
    if (Array.isArray(val)) return val.map((v) => String(v)).join(", ");
    if (val === null || val === void 0) return void 0;
    if (typeof val === "object") return "";
    return String(val);
  }
  /**
   * Convert frontmatter object using mapping to internal task data
   */
  mapFromFrontmatter(frontmatter, filePath, storeTitleInFilename) {
    if (!frontmatter) return {};
    const mapped = {
      path: filePath
    };
    if (frontmatter[this.mapping.title] !== void 0) {
      const rawTitle = frontmatter[this.mapping.title];
      const normalized = this.normalizeTitle(rawTitle);
      if (normalized !== void 0) {
        mapped.title = normalized;
      }
    } else if (storeTitleInFilename) {
      const filename = filePath.split("/").pop()?.replace(".md", "");
      if (filename) {
        mapped.title = filename;
      }
    }
    if (frontmatter[this.mapping.status] !== void 0) {
      const statusValue = frontmatter[this.mapping.status];
      if (typeof statusValue === "boolean") {
        mapped.status = statusValue ? "true" : "false";
      } else {
        mapped.status = statusValue;
      }
    }
    if (frontmatter[this.mapping.priority] !== void 0) {
      mapped.priority = frontmatter[this.mapping.priority];
    }
    if (frontmatter[this.mapping.due] !== void 0) {
      mapped.due = frontmatter[this.mapping.due];
    }
    if (frontmatter[this.mapping.scheduled] !== void 0) {
      mapped.scheduled = frontmatter[this.mapping.scheduled];
    }
    if (frontmatter[this.mapping.contexts] !== void 0) {
      const contexts = frontmatter[this.mapping.contexts];
      mapped.contexts = Array.isArray(contexts) ? contexts : [contexts];
    }
    if (frontmatter[this.mapping.projects] !== void 0) {
      const projects = frontmatter[this.mapping.projects];
      mapped.projects = Array.isArray(projects) ? projects : [projects];
    }
    if (frontmatter[this.mapping.timeEstimate] !== void 0) {
      mapped.timeEstimate = frontmatter[this.mapping.timeEstimate];
    }
    if (frontmatter[this.mapping.completedDate] !== void 0) {
      mapped.completedDate = frontmatter[this.mapping.completedDate];
    }
    if (frontmatter[this.mapping.recurrence] !== void 0) {
      mapped.recurrence = frontmatter[this.mapping.recurrence];
    }
    if (frontmatter[this.mapping.recurrenceAnchor] !== void 0) {
      const anchorValue = frontmatter[this.mapping.recurrenceAnchor];
      if (anchorValue === "scheduled" || anchorValue === "completion") {
        mapped.recurrence_anchor = anchorValue;
      } else {
        console.warn(`Invalid recurrence_anchor value: ${anchorValue}, defaulting to 'scheduled'`);
        mapped.recurrence_anchor = "scheduled";
      }
    }
    if (frontmatter[this.mapping.dateCreated] !== void 0) {
      mapped.dateCreated = frontmatter[this.mapping.dateCreated];
    }
    if (frontmatter[this.mapping.dateModified] !== void 0) {
      mapped.dateModified = frontmatter[this.mapping.dateModified];
    }
    if (frontmatter[this.mapping.timeEntries] !== void 0) {
      const timeEntriesValue = frontmatter[this.mapping.timeEntries];
      mapped.timeEntries = Array.isArray(timeEntriesValue) ? timeEntriesValue : [];
    }
    if (frontmatter[this.mapping.completeInstances] !== void 0) {
      mapped.complete_instances = validateCompleteInstances(
        frontmatter[this.mapping.completeInstances]
      );
    }
    if (frontmatter[this.mapping.skippedInstances] !== void 0) {
      mapped.skipped_instances = validateCompleteInstances(
        frontmatter[this.mapping.skippedInstances]
      );
    }
    if (this.mapping.blockedBy && frontmatter[this.mapping.blockedBy] !== void 0) {
      const dependencies = normalizeDependencyList(frontmatter[this.mapping.blockedBy]);
      if (dependencies) {
        mapped.blockedBy = dependencies;
      }
    }
    if (frontmatter[this.mapping.icsEventId] !== void 0) {
      const icsEventId = frontmatter[this.mapping.icsEventId];
      mapped.icsEventId = Array.isArray(icsEventId) ? icsEventId : [icsEventId];
    }
    if (frontmatter[this.mapping.googleCalendarEventId] !== void 0) {
      mapped.googleCalendarEventId = frontmatter[this.mapping.googleCalendarEventId];
    }
    if (frontmatter[this.mapping.reminders] !== void 0) {
      const reminders = frontmatter[this.mapping.reminders];
      if (Array.isArray(reminders)) {
        const filteredReminders = reminders.filter((r) => r != null);
        if (filteredReminders.length > 0) {
          mapped.reminders = filteredReminders;
        }
      } else if (reminders != null) {
        mapped.reminders = [reminders];
      }
    }
    if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
      mapped.tags = frontmatter.tags;
      mapped.archived = frontmatter.tags.includes(this.mapping.archiveTag);
    }
    return mapped;
  }
  /**
   * Convert internal task data to frontmatter using mapping
   */
  mapToFrontmatter(taskData, taskTag, storeTitleInFilename) {
    const frontmatter = {};
    if (taskData.title !== void 0) {
      frontmatter[this.mapping.title] = taskData.title;
    }
    if (taskData.status !== void 0) {
      const lower = taskData.status.toLowerCase();
      const coercedValue = lower === "true" || lower === "false" ? lower === "true" : taskData.status;
      frontmatter[this.mapping.status] = coercedValue;
    }
    if (taskData.priority !== void 0) {
      frontmatter[this.mapping.priority] = taskData.priority;
    }
    if (taskData.due !== void 0) {
      frontmatter[this.mapping.due] = taskData.due;
    }
    if (taskData.scheduled !== void 0) {
      frontmatter[this.mapping.scheduled] = taskData.scheduled;
    }
    if (taskData.contexts !== void 0 && (!Array.isArray(taskData.contexts) || taskData.contexts.length > 0)) {
      frontmatter[this.mapping.contexts] = taskData.contexts;
    }
    if (taskData.projects !== void 0 && (!Array.isArray(taskData.projects) || taskData.projects.length > 0)) {
      frontmatter[this.mapping.projects] = taskData.projects;
    }
    if (taskData.timeEstimate !== void 0) {
      frontmatter[this.mapping.timeEstimate] = taskData.timeEstimate;
    }
    if (taskData.completedDate !== void 0) {
      frontmatter[this.mapping.completedDate] = taskData.completedDate;
    }
    if (taskData.recurrence !== void 0) {
      frontmatter[this.mapping.recurrence] = taskData.recurrence;
    }
    if (taskData.recurrence_anchor !== void 0) {
      frontmatter[this.mapping.recurrenceAnchor] = taskData.recurrence_anchor;
    }
    if (taskData.dateCreated !== void 0) {
      frontmatter[this.mapping.dateCreated] = taskData.dateCreated;
    }
    if (taskData.dateModified !== void 0) {
      frontmatter[this.mapping.dateModified] = taskData.dateModified;
    }
    if (taskData.timeEntries !== void 0) {
      frontmatter[this.mapping.timeEntries] = taskData.timeEntries;
    }
    if (taskData.complete_instances !== void 0) {
      frontmatter[this.mapping.completeInstances] = taskData.complete_instances;
    }
    if (taskData.skipped_instances !== void 0 && taskData.skipped_instances.length > 0) {
      frontmatter[this.mapping.skippedInstances] = taskData.skipped_instances;
    }
    if (taskData.blockedBy !== void 0) {
      if (Array.isArray(taskData.blockedBy)) {
        const normalized = taskData.blockedBy.map((item) => normalizeDependencyEntry(item)).filter((item) => !!item);
        if (normalized.length > 0) {
          frontmatter[this.mapping.blockedBy] = serializeDependencies(normalized);
        }
      } else {
        frontmatter[this.mapping.blockedBy] = taskData.blockedBy;
      }
    }
    if (taskData.icsEventId !== void 0 && taskData.icsEventId.length > 0) {
      frontmatter[this.mapping.icsEventId] = taskData.icsEventId;
    }
    if (taskData.reminders !== void 0 && taskData.reminders.length > 0) {
      frontmatter[this.mapping.reminders] = taskData.reminders;
    }
    let tags = taskData.tags ? [...taskData.tags] : [];
    if (taskTag && !tags.includes(taskTag)) {
      tags.push(taskTag);
    }
    if (taskData.archived === true && !tags.includes(this.mapping.archiveTag)) {
      tags.push(this.mapping.archiveTag);
    } else if (taskData.archived === false) {
      tags = tags.filter((tag) => tag !== this.mapping.archiveTag);
    }
    if (tags.length > 0) {
      frontmatter.tags = tags;
    }
    return frontmatter;
  }
  /**
   * Update mapping configuration
   */
  updateMapping(newMapping) {
    this.mapping = newMapping;
  }
  /**
   * Get current mapping
   */
  getMapping() {
    return { ...this.mapping };
  }
  /**
   * Look up the FieldMapping key for a given frontmatter property name.
   *
   * IMPORTANT: This returns the MAPPING KEY (e.g., "completeInstances"),
   * NOT the frontmatter property name (e.g., "complete_instances").
   *
   * Use this to check if a property is recognized/mapped, but DO NOT use
   * the returned key directly as a property identifier for TaskCard.
   *
   * @param frontmatterPropertyName - The property name from YAML (e.g., "complete_instances")
   * @returns The FieldMapping key (e.g., "completeInstances") or null if not found
   *
   * @example
   * // Given mapping: { completeInstances: "complete_instances" }
   * lookupMappingKey("complete_instances") // Returns: "completeInstances"
   * lookupMappingKey("unknown_field")      // Returns: null
   */
  lookupMappingKey(frontmatterPropertyName) {
    for (const [mappingKey, propertyName] of Object.entries(this.mapping)) {
      if (propertyName === frontmatterPropertyName) {
        return mappingKey;
      }
    }
    return null;
  }
  /**
   * Check if a frontmatter property name is a recognized/configured field.
   * Returns true if the property has a mapping, false otherwise.
   *
   * @param frontmatterPropertyName - The property name from YAML
   * @returns true if the property is recognized, false otherwise
   */
  isRecognizedProperty(frontmatterPropertyName) {
    return this.lookupMappingKey(frontmatterPropertyName) !== null;
  }
  /**
   * Check if a property name matches a specific internal field.
   * This handles user-configured field names properly.
   *
   * @param propertyName - The property name to check (could be user-configured or internal)
   * @param internalField - The internal field key to check against
   * @returns true if the propertyName is the user's configured name for this field
   *
   * @example
   * // User has { status: "task-status" }
   * isPropertyForField("task-status", "status") // true
   * isPropertyForField("status", "status")      // false
   *
   * // User has { status: "status" } (default)
   * isPropertyForField("status", "status")      // true
   */
  isPropertyForField(propertyName, internalField) {
    return this.mapping[internalField] === propertyName;
  }
  /**
   * Convert an array of internal field names to their user-configured property names.
   *
   * @param internalFields - Array of FieldMapping keys
   * @returns Array of user-configured property names
   *
   * @example
   * // User has { status: "task-status", due: "deadline" }
   * toUserFields(["status", "due", "priority"])
   * // Returns: ["task-status", "deadline", "priority"]
   */
  toUserFields(internalFields) {
    return internalFields.map((field) => this.mapping[field]);
  }
  /**
   * @deprecated Use lookupMappingKey() instead for clarity about what is returned
   * Convert user's property name back to internal field name
   * This is the reverse of toUserField()
   */
  fromUserField(userPropertyName) {
    return this.lookupMappingKey(userPropertyName);
  }
  /**
   * Validate that a mapping has no empty field names
   */
  static validateMapping(mapping) {
    const errors = [];
    const fields = Object.keys(mapping);
    for (const field of fields) {
      if (!mapping[field] || mapping[field].trim() === "") {
        errors.push(`Field "${field}" cannot be empty`);
      }
    }
    const values = Object.values(mapping);
    const uniqueValues = new Set(values);
    if (values.length !== uniqueValues.size) {
      errors.push("Field mappings must have unique property names");
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// src/settings/defaults.ts
var DEFAULT_FIELD_MAPPING = {
  title: "title",
  status: "status",
  priority: "priority",
  due: "due",
  scheduled: "scheduled",
  contexts: "contexts",
  projects: "projects",
  timeEstimate: "timeEstimate",
  completedDate: "completedDate",
  dateCreated: "dateCreated",
  dateModified: "dateModified",
  recurrence: "recurrence",
  recurrenceAnchor: "recurrence_anchor",
  archiveTag: "archived",
  timeEntries: "timeEntries",
  completeInstances: "complete_instances",
  skippedInstances: "skipped_instances",
  blockedBy: "blockedBy",
  pomodoros: "pomodoros",
  icsEventId: "icsEventId",
  icsEventTag: "ics_event",
  googleCalendarEventId: "googleCalendarEventId",
  reminders: "reminders"
};

// ../../../../tmp/tasknotes-conformance-smoke.ts
console.log(parseDateToUTC("2026-02-20").toISOString().slice(0, 10));
console.log(parseDateToLocal("2026-02-20").toISOString().slice(0, 10));
console.log(isSameDateSafe("2026-02-20", "2026-02-20T09:00:00Z"));
var mapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
console.log(mapper.toUserField("title"));
