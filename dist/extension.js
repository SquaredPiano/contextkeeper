/******/ (() => {
  // webpackBootstrap
  /******/ var __webpack_modules__ = [
    /* 0 */
    /***/ function (__unused_webpack_module, exports, __webpack_require__) {
      "use strict";

      var __createBinding =
        (this && this.__createBinding) ||
        (Object.create
          ? function (o, m, k, k2) {
              if (k2 === undefined) k2 = k;
              var desc = Object.getOwnPropertyDescriptor(m, k);
              if (
                !desc ||
                ("get" in desc
                  ? !m.__esModule
                  : desc.writable || desc.configurable)
              ) {
                desc = {
                  enumerable: true,
                  get: function () {
                    return m[k];
                  },
                };
              }
              Object.defineProperty(o, k2, desc);
            }
          : function (o, m, k, k2) {
              if (k2 === undefined) k2 = k;
              o[k2] = m[k];
            });
      var __setModuleDefault =
        (this && this.__setModuleDefault) ||
        (Object.create
          ? function (o, v) {
              Object.defineProperty(o, "default", {
                enumerable: true,
                value: v,
              });
            }
          : function (o, v) {
              o["default"] = v;
            });
      var __importStar =
        (this && this.__importStar) ||
        (function () {
          var ownKeys = function (o) {
            ownKeys =
              Object.getOwnPropertyNames ||
              function (o) {
                var ar = [];
                for (var k in o)
                  if (Object.prototype.hasOwnProperty.call(o, k))
                    ar[ar.length] = k;
                return ar;
              };
            return ownKeys(o);
          };
          return function (mod) {
            if (mod && mod.__esModule) return mod;
            var result = {};
            if (mod != null)
              for (var k = ownKeys(mod), i = 0; i < k.length; i++)
                if (k[i] !== "default") __createBinding(result, mod, k[i]);
            __setModuleDefault(result, mod);
            return result;
          };
        })();
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.activate = activate;
      exports.deactivate = deactivate;
      // The module 'vscode' contains the VS Code extensibility API
      // Import the module and reference it with the alias vscode in your code below
      const vscode = __importStar(__webpack_require__(1));
      const gitlog_1 = __webpack_require__(2);
      // This method is called when your extension is activated
      // Your extension is activated the very first time the command is executed
      function activate(context) {
        // Use the console to output diagnostic information (console.log) and errors (console.error)
        // This line of code will only be executed once when your extension is activated
        console.log(
          'Congratulations, your extension "contextkeeper" is now active!'
        );
        // The command has been defined in the package.json file
        // Now provide the implementation of the command with registerCommand
        // The commandId parameter must match the command field in package.json
        const disposable = vscode.commands.registerCommand(
          "contextkeeper.helloWorld",
          () => {
            // The code you place here will be executed every time your command is executed
            // Display a message box to the user
            vscode.window.showInformationMessage(
              "Hello World from contextkeeper!"
            );
          }
        );
        const testGitlog = vscode.commands.registerCommand(
          "contextkeeper.testGitlog",
          async () => {
            try {
              vscode.window.showInformationMessage("Fetching git logs...");
              const logs = await (0, gitlog_1.getLogsWithGitlog)();
              const outputChannel =
                vscode.window.createOutputChannel("ContextKeeper");
              outputChannel.clear();
              outputChannel.appendLine("=== Recent Git Commits ===");
              logs.forEach((commit, i) => {
                outputChannel.appendLine(`\n${i + 1}. ${commit.subject}`);
                outputChannel.appendLine(`   Author: ${commit.authorName}`);
                outputChannel.appendLine(`   Hash: ${commit.hash}`);
                outputChannel.appendLine(`   Date: ${commit.authorDate}`);
              });
              outputChannel.show();
              vscode.window.showInformationMessage(
                `✅ Found ${logs.length} commits!`
              );
            } catch (err) {
              vscode.window.showErrorMessage(`❌ Error: ${err.message}`);
              console.error("Gitlog error:", err);
            }
          }
        );
        context.subscriptions.push(testGitlog);
        context.subscriptions.push(disposable);
      }
      // This method is called when your extension is deactivated
      function deactivate() {}

      /***/
    },
    /* 1 */
    /***/ (module) => {
      "use strict";
      module.exports = require("vscode");

      /***/
    },
    /* 2 */
    /***/ function (__unused_webpack_module, exports, __webpack_require__) {
      "use strict";

      var __createBinding =
        (this && this.__createBinding) ||
        (Object.create
          ? function (o, m, k, k2) {
              if (k2 === undefined) k2 = k;
              var desc = Object.getOwnPropertyDescriptor(m, k);
              if (
                !desc ||
                ("get" in desc
                  ? !m.__esModule
                  : desc.writable || desc.configurable)
              ) {
                desc = {
                  enumerable: true,
                  get: function () {
                    return m[k];
                  },
                };
              }
              Object.defineProperty(o, k2, desc);
            }
          : function (o, m, k, k2) {
              if (k2 === undefined) k2 = k;
              o[k2] = m[k];
            });
      var __setModuleDefault =
        (this && this.__setModuleDefault) ||
        (Object.create
          ? function (o, v) {
              Object.defineProperty(o, "default", {
                enumerable: true,
                value: v,
              });
            }
          : function (o, v) {
              o["default"] = v;
            });
      var __importStar =
        (this && this.__importStar) ||
        (function () {
          var ownKeys = function (o) {
            ownKeys =
              Object.getOwnPropertyNames ||
              function (o) {
                var ar = [];
                for (var k in o)
                  if (Object.prototype.hasOwnProperty.call(o, k))
                    ar[ar.length] = k;
                return ar;
              };
            return ownKeys(o);
          };
          return function (mod) {
            if (mod && mod.__esModule) return mod;
            var result = {};
            if (mod != null)
              for (var k = ownKeys(mod), i = 0; i < k.length; i++)
                if (k[i] !== "default") __createBinding(result, mod, k[i]);
            __setModuleDefault(result, mod);
            return result;
          };
        })();
      var __importDefault =
        (this && this.__importDefault) ||
        function (mod) {
          return mod && mod.__esModule ? mod : { default: mod };
        };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getLogsWithGitlog = getLogsWithGitlog;
      const gitlog_1 = __importDefault(__webpack_require__(3)); // Default import, not named import
      const vscode = __importStar(__webpack_require__(1));
      async function getLogsWithGitlog() {
        const workspaceFolder =
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
          throw new Error("No workspace folder found");
        }
        const commits = await (0, gitlog_1.default)({
          repo: workspaceFolder,
          number: 10,
          fields: ["hash", "authorName", "authorDate", "subject"],
        });
        return commits;
      }

      /***/
    },
    /* 3 */
    /***/ (
      __unused_webpack___webpack_module__,
      __webpack_exports__,
      __webpack_require__
    ) => {
      "use strict";
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ default: () => __WEBPACK_DEFAULT_EXPORT__,
        /* harmony export */
      });
      /* harmony import */ var node_child_process__WEBPACK_IMPORTED_MODULE_0__ =
        __webpack_require__(4);
      /* harmony import */ var node_util__WEBPACK_IMPORTED_MODULE_1__ =
        __webpack_require__(5);
      /* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_2__ =
        __webpack_require__(6);
      /* harmony import */ var debug__WEBPACK_IMPORTED_MODULE_3__ =
        __webpack_require__(7);
      var __assign =
        (undefined && undefined.__assign) ||
        function () {
          __assign =
            Object.assign ||
            function (t) {
              for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s)
                  if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
              }
              return t;
            };
          return __assign.apply(this, arguments);
        };
      var __awaiter =
        (undefined && undefined.__awaiter) ||
        function (thisArg, _arguments, P, generator) {
          function adopt(value) {
            return value instanceof P
              ? value
              : new P(function (resolve) {
                  resolve(value);
                });
          }
          return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) {
              try {
                step(generator.next(value));
              } catch (e) {
                reject(e);
              }
            }
            function rejected(value) {
              try {
                step(generator["throw"](value));
              } catch (e) {
                reject(e);
              }
            }
            function step(result) {
              result.done
                ? resolve(result.value)
                : adopt(result.value).then(fulfilled, rejected);
            }
            step(
              (generator = generator.apply(thisArg, _arguments || [])).next()
            );
          });
        };
      var __generator =
        (undefined && undefined.__generator) ||
        function (thisArg, body) {
          var _ = {
              label: 0,
              sent: function () {
                if (t[0] & 1) throw t[1];
                return t[1];
              },
              trys: [],
              ops: [],
            },
            f,
            y,
            t,
            g;
          return (
            (g = { next: verb(0), throw: verb(1), return: verb(2) }),
            typeof Symbol === "function" &&
              (g[Symbol.iterator] = function () {
                return this;
              }),
            g
          );
          function verb(n) {
            return function (v) {
              return step([n, v]);
            };
          }
          function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while ((g && ((g = 0), op[0] && (_ = 0)), _))
              try {
                if (
                  ((f = 1),
                  y &&
                    (t =
                      op[0] & 2
                        ? y["return"]
                        : op[0]
                        ? y["throw"] || ((t = y["return"]) && t.call(y), 0)
                        : y.next) &&
                    !(t = t.call(y, op[1])).done)
                )
                  return t;
                if (((y = 0), t)) op = [op[0] & 2, t.value];
                switch (op[0]) {
                  case 0:
                  case 1:
                    t = op;
                    break;
                  case 4:
                    _.label++;
                    return { value: op[1], done: false };
                  case 5:
                    _.label++;
                    y = op[1];
                    op = [0];
                    continue;
                  case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                  default:
                    if (
                      !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                      (op[0] === 6 || op[0] === 2)
                    ) {
                      _ = 0;
                      continue;
                    }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                      _.label = op[1];
                      break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                      _.label = t[1];
                      t = op;
                      break;
                    }
                    if (t && _.label < t[2]) {
                      _.label = t[2];
                      _.ops.push(op);
                      break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
                }
                op = body.call(thisArg, _);
              } catch (e) {
                op = [6, e];
                y = 0;
              } finally {
                f = t = 0;
              }
            if (op[0] & 5) throw op[1];
            return { value: op[0] ? op[1] : void 0, done: true };
          }
        };

      var debug = debug__WEBPACK_IMPORTED_MODULE_3__("gitlog");
      var execFilePromise = (0,
      node_util__WEBPACK_IMPORTED_MODULE_1__.promisify)(
        node_child_process__WEBPACK_IMPORTED_MODULE_0__.execFile
      );
      var delimiter = "\x1E";
      var fieldMap = {
        hash: "%H",
        abbrevHash: "%h",
        treeHash: "%T",
        abbrevTreeHash: "%t",
        parentHashes: "%P",
        abbrevParentHashes: "%P",
        authorName: "%an",
        authorEmail: "%ae",
        authorDate: "%ai",
        authorDateRel: "%ar",
        committerName: "%cn",
        committerEmail: "%ce",
        committerDate: "%cd",
        committerDateRel: "%cr",
        subject: "%s",
        body: "%b",
        rawBody: "%B",
        tag: "%D",
      };
      var notOptFields = ["status", "files"];
      var defaultFields = [
        "abbrevHash",
        "hash",
        "subject",
        "authorName",
        "authorDate",
      ];
      var defaultOptions = {
        number: 10,
        fields: defaultFields,
        nameStatus: true,
        includeMergeCommitFiles: false,
        follow: false,
        findCopiesHarder: false,
        all: false,
      };
      /** Add optional parameter to command */
      function addOptionalArguments(command, options) {
        var commandWithOptions = command;
        var cmdOptional = [
          "author",
          "since",
          "after",
          "until",
          "before",
          "committer",
        ];
        for (var i = cmdOptional.length; i--; ) {
          if (options[cmdOptional[i]]) {
            commandWithOptions.push(
              "--".concat(cmdOptional[i], "=").concat(options[cmdOptional[i]])
            );
          }
        }
        return commandWithOptions;
      }
      /** Parse the output of "git log" for commit information */
      var parseCommits = function (commits, fields, nameStatus) {
        return commits.map(function (rawCommit) {
          var parts = rawCommit.split("@end@");
          var commit = parts[0].split(delimiter);
          if (parts[1]) {
            var parseNameStatus = parts[1].trimLeft().split("\n");
            // Removes last empty char if exists
            if (parseNameStatus[parseNameStatus.length - 1] === "") {
              parseNameStatus.pop();
            }
            // Split each line into it's own delimited array
            // Using tab character here because the name status output is always tab separated
            var nameAndStatusDelimited = parseNameStatus.map(function (d) {
              return d.split("\t");
            });
            // 0 will always be status, last will be the filename as it is in the commit,
            // anything in between could be the old name if renamed or copied
            nameAndStatusDelimited.forEach(function (item) {
              var status = item[0];
              var tempArr = [status, item[item.length - 1]];
              // If any files in between loop through them
              for (var i = 1, len = item.length - 1; i < len; i++) {
                // If status R then add the old filename as a deleted file + status
                // Other potentials are C for copied but this wouldn't require the original deleting
                if (status.slice(0, 1) === "R") {
                  tempArr.push("D", item[i]);
                }
              }
              commit.push.apply(commit, tempArr);
            });
          }
          debug("commit", commit);
          // Remove the first empty char from the array
          commit.shift();
          var parsed = {};
          if (nameStatus) {
            // Create arrays for non optional fields if turned on
            notOptFields.forEach(function (d) {
              parsed[d] = [];
            });
          }
          commit.forEach(function (commitField, index) {
            if (fields[index]) {
              parsed[fields[index]] = commitField;
            } else if (nameStatus) {
              var pos = (index - fields.length) % notOptFields.length;
              debug(
                "nameStatus",
                index - fields.length,
                notOptFields.length,
                pos,
                commitField
              );
              var arr = parsed[notOptFields[pos]];
              if (Array.isArray(arr)) {
                arr.push(commitField);
              }
            }
          });
          return parsed;
        });
      };
      /** Run "git log" and return the result as JSON */
      function createCommandArguments(options) {
        // Start constructing command
        var command = ["log", "-l0"];
        if (options.findCopiesHarder) {
          command.push("--find-copies-harder");
        }
        if (options.all) {
          command.push("--all");
        }
        if (options.includeMergeCommitFiles) {
          command.push("-m");
        }
        if (options.follow) {
          command.push("--follow");
        }
        command.push("-n ".concat(options.number));
        command = addOptionalArguments(command, options);
        // Start of custom format
        var prettyArgument = "--pretty=@begin@";
        // Iterating through the fields and adding them to the custom format
        if (options.fields) {
          options.fields.forEach(function (field) {
            if (!fieldMap[field] && !notOptFields.includes(field)) {
              throw new Error("Unknown field: ".concat(field));
            }
            prettyArgument += delimiter + fieldMap[field];
          });
        }
        // Close custom format
        prettyArgument += "@end@";
        command.push(prettyArgument);
        // Append branch (revision range) if specified
        if (options.branch) {
          command.push(options.branch);
        }
        // File and file status
        if (options.nameStatus && !options.fileLineRange) {
          command.push("--name-status");
        }
        if (options.fileLineRange) {
          command.push(
            "-L "
              .concat(options.fileLineRange.startLine, ",")
              .concat(options.fileLineRange.endLine, ":")
              .concat(options.fileLineRange.file)
          );
        }
        if (options.file) {
          command.push("--");
          command.push(options.file);
        }
        debug("command", options.execOptions, command);
        return command;
      }
      function gitlog(userOptions) {
        return __awaiter(this, void 0, void 0, function () {
          var options, execOptions, commandArguments, stdout, commits;
          return __generator(this, function (_a) {
            switch (_a.label) {
              case 0:
                if (!userOptions.repo) {
                  throw new Error("Repo required!");
                }
                if (
                  !(0, fs__WEBPACK_IMPORTED_MODULE_2__.existsSync)(
                    userOptions.repo
                  )
                ) {
                  throw new Error("Repo location does not exist");
                }
                options = __assign(__assign({}, defaultOptions), userOptions);
                execOptions = __assign(
                  { cwd: userOptions.repo },
                  userOptions.execOptions
                );
                commandArguments = createCommandArguments(options);
                return [
                  4 /*yield*/,
                  execFilePromise("git", commandArguments, execOptions),
                ];
              case 1:
                stdout = _a.sent().stdout;
                commits = stdout.split("@begin@");
                if (commits[0] === "") {
                  commits.shift();
                }
                debug("commits", commits);
                return [
                  2 /*return*/,
                  parseCommits(commits, options.fields, options.nameStatus),
                ];
            }
          });
        });
      }
      /* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = gitlog;
      //# sourceMappingURL=index.js.map

      /***/
    },
    /* 4 */
    /***/ (module) => {
      "use strict";
      module.exports = require("node:child_process");

      /***/
    },
    /* 5 */
    /***/ (module) => {
      "use strict";
      module.exports = require("node:util");

      /***/
    },
    /* 6 */
    /***/ (module) => {
      "use strict";
      module.exports = require("fs");

      /***/
    },
    /* 7 */
    /***/ (module, __unused_webpack_exports, __webpack_require__) => {
      /**
       * Detect Electron renderer / nwjs process, which is node, but we should
       * treat as a browser.
       */

      if (
        typeof process === "undefined" ||
        process.type === "renderer" ||
        process.browser === true ||
        process.__nwjs
      ) {
        module.exports = __webpack_require__(8);
      } else {
        module.exports = __webpack_require__(11);
      }

      /***/
    },
    /* 8 */
    /***/ (module, exports, __webpack_require__) => {
      /* eslint-env browser */

      /**
       * This is the web browser implementation of `debug()`.
       */

      exports.formatArgs = formatArgs;
      exports.save = save;
      exports.load = load;
      exports.useColors = useColors;
      exports.storage = localstorage();
      exports.destroy = (() => {
        let warned = false;

        return () => {
          if (!warned) {
            warned = true;
            console.warn(
              "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
            );
          }
        };
      })();

      /**
       * Colors.
       */

      exports.colors = [
        "#0000CC",
        "#0000FF",
        "#0033CC",
        "#0033FF",
        "#0066CC",
        "#0066FF",
        "#0099CC",
        "#0099FF",
        "#00CC00",
        "#00CC33",
        "#00CC66",
        "#00CC99",
        "#00CCCC",
        "#00CCFF",
        "#3300CC",
        "#3300FF",
        "#3333CC",
        "#3333FF",
        "#3366CC",
        "#3366FF",
        "#3399CC",
        "#3399FF",
        "#33CC00",
        "#33CC33",
        "#33CC66",
        "#33CC99",
        "#33CCCC",
        "#33CCFF",
        "#6600CC",
        "#6600FF",
        "#6633CC",
        "#6633FF",
        "#66CC00",
        "#66CC33",
        "#9900CC",
        "#9900FF",
        "#9933CC",
        "#9933FF",
        "#99CC00",
        "#99CC33",
        "#CC0000",
        "#CC0033",
        "#CC0066",
        "#CC0099",
        "#CC00CC",
        "#CC00FF",
        "#CC3300",
        "#CC3333",
        "#CC3366",
        "#CC3399",
        "#CC33CC",
        "#CC33FF",
        "#CC6600",
        "#CC6633",
        "#CC9900",
        "#CC9933",
        "#CCCC00",
        "#CCCC33",
        "#FF0000",
        "#FF0033",
        "#FF0066",
        "#FF0099",
        "#FF00CC",
        "#FF00FF",
        "#FF3300",
        "#FF3333",
        "#FF3366",
        "#FF3399",
        "#FF33CC",
        "#FF33FF",
        "#FF6600",
        "#FF6633",
        "#FF9900",
        "#FF9933",
        "#FFCC00",
        "#FFCC33",
      ];

      /**
       * Currently only WebKit-based Web Inspectors, Firefox >= v31,
       * and the Firebug extension (any Firefox version) are known
       * to support "%c" CSS customizations.
       *
       * TODO: add a `localStorage` variable to explicitly enable/disable colors
       */

      // eslint-disable-next-line complexity
      function useColors() {
        // NB: In an Electron preload script, document will be defined but not fully
        // initialized. Since we know we're in Chrome, we'll just detect this case
        // explicitly
        if (
          typeof window !== "undefined" &&
          window.process &&
          (window.process.type === "renderer" || window.process.__nwjs)
        ) {
          return true;
        }

        // Internet Explorer and Edge do not support colors.
        if (
          typeof navigator !== "undefined" &&
          navigator.userAgent &&
          navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)
        ) {
          return false;
        }

        let m;

        // Is webkit? http://stackoverflow.com/a/16459606/376773
        // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
        // eslint-disable-next-line no-return-assign
        return (
          (typeof document !== "undefined" &&
            document.documentElement &&
            document.documentElement.style &&
            document.documentElement.style.WebkitAppearance) ||
          // Is firebug? http://stackoverflow.com/a/398120/376773
          (typeof window !== "undefined" &&
            window.console &&
            (window.console.firebug ||
              (window.console.exception && window.console.table))) ||
          // Is firefox >= v31?
          // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
          (typeof navigator !== "undefined" &&
            navigator.userAgent &&
            (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) &&
            parseInt(m[1], 10) >= 31) ||
          // Double check webkit in userAgent just in case we are in a worker
          (typeof navigator !== "undefined" &&
            navigator.userAgent &&
            navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))
        );
      }

      /**
       * Colorize log arguments if enabled.
       *
       * @api public
       */

      function formatArgs(args) {
        args[0] =
          (this.useColors ? "%c" : "") +
          this.namespace +
          (this.useColors ? " %c" : " ") +
          args[0] +
          (this.useColors ? "%c " : " ") +
          "+" +
          module.exports.humanize(this.diff);

        if (!this.useColors) {
          return;
        }

        const c = "color: " + this.color;
        args.splice(1, 0, c, "color: inherit");

        // The final "%c" is somewhat tricky, because there could be other
        // arguments passed either before or after the %c, so we need to
        // figure out the correct index to insert the CSS into
        let index = 0;
        let lastC = 0;
        args[0].replace(/%[a-zA-Z%]/g, (match) => {
          if (match === "%%") {
            return;
          }
          index++;
          if (match === "%c") {
            // We only are interested in the *last* %c
            // (the user may have provided their own)
            lastC = index;
          }
        });

        args.splice(lastC, 0, c);
      }

      /**
       * Invokes `console.debug()` when available.
       * No-op when `console.debug` is not a "function".
       * If `console.debug` is not available, falls back
       * to `console.log`.
       *
       * @api public
       */
      exports.log = console.debug || console.log || (() => {});

      /**
       * Save `namespaces`.
       *
       * @param {String} namespaces
       * @api private
       */
      function save(namespaces) {
        try {
          if (namespaces) {
            exports.storage.setItem("debug", namespaces);
          } else {
            exports.storage.removeItem("debug");
          }
        } catch (error) {
          // Swallow
          // XXX (@Qix-) should we be logging these?
        }
      }

      /**
       * Load `namespaces`.
       *
       * @return {String} returns the previously persisted debug modes
       * @api private
       */
      function load() {
        let r;
        try {
          r =
            exports.storage.getItem("debug") ||
            exports.storage.getItem("DEBUG");
        } catch (error) {
          // Swallow
          // XXX (@Qix-) should we be logging these?
        }

        // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
        if (!r && typeof process !== "undefined" && "env" in process) {
          r = process.env.DEBUG;
        }

        return r;
      }

      /**
       * Localstorage attempts to return the localstorage.
       *
       * This is necessary because safari throws
       * when a user disables cookies/localstorage
       * and you attempt to access it.
       *
       * @return {LocalStorage}
       * @api private
       */

      function localstorage() {
        try {
          // TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
          // The Browser also has localStorage in the global context.
          return localStorage;
        } catch (error) {
          // Swallow
          // XXX (@Qix-) should we be logging these?
        }
      }

      module.exports = __webpack_require__(9)(exports);

      const { formatters } = module.exports;

      /**
       * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
       */

      formatters.j = function (v) {
        try {
          return JSON.stringify(v);
        } catch (error) {
          return "[UnexpectedJSONParseError]: " + error.message;
        }
      };

      /***/
    },
    /* 9 */
    /***/ (module, __unused_webpack_exports, __webpack_require__) => {
      /**
       * This is the common logic for both the Node.js and web browser
       * implementations of `debug()`.
       */

      function setup(env) {
        createDebug.debug = createDebug;
        createDebug.default = createDebug;
        createDebug.coerce = coerce;
        createDebug.disable = disable;
        createDebug.enable = enable;
        createDebug.enabled = enabled;
        createDebug.humanize = __webpack_require__(10);
        createDebug.destroy = destroy;

        Object.keys(env).forEach((key) => {
          createDebug[key] = env[key];
        });

        /**
         * The currently active debug mode names, and names to skip.
         */

        createDebug.names = [];
        createDebug.skips = [];

        /**
         * Map of special "%n" handling functions, for the debug "format" argument.
         *
         * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
         */
        createDebug.formatters = {};

        /**
         * Selects a color for a debug namespace
         * @param {String} namespace The namespace string for the debug instance to be colored
         * @return {Number|String} An ANSI color code for the given namespace
         * @api private
         */
        function selectColor(namespace) {
          let hash = 0;

          for (let i = 0; i < namespace.length; i++) {
            hash = (hash << 5) - hash + namespace.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
          }

          return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
        }
        createDebug.selectColor = selectColor;

        /**
         * Create a debugger with the given `namespace`.
         *
         * @param {String} namespace
         * @return {Function}
         * @api public
         */
        function createDebug(namespace) {
          let prevTime;
          let enableOverride = null;
          let namespacesCache;
          let enabledCache;

          function debug(...args) {
            // Disabled?
            if (!debug.enabled) {
              return;
            }

            const self = debug;

            // Set `diff` timestamp
            const curr = Number(new Date());
            const ms = curr - (prevTime || curr);
            self.diff = ms;
            self.prev = prevTime;
            self.curr = curr;
            prevTime = curr;

            args[0] = createDebug.coerce(args[0]);

            if (typeof args[0] !== "string") {
              // Anything else let's inspect with %O
              args.unshift("%O");
            }

            // Apply any `formatters` transformations
            let index = 0;
            args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
              // If we encounter an escaped % then don't increase the array index
              if (match === "%%") {
                return "%";
              }
              index++;
              const formatter = createDebug.formatters[format];
              if (typeof formatter === "function") {
                const val = args[index];
                match = formatter.call(self, val);

                // Now we need to remove `args[index]` since it's inlined in the `format`
                args.splice(index, 1);
                index--;
              }
              return match;
            });

            // Apply env-specific formatting (colors, etc.)
            createDebug.formatArgs.call(self, args);

            const logFn = self.log || createDebug.log;
            logFn.apply(self, args);
          }

          debug.namespace = namespace;
          debug.useColors = createDebug.useColors();
          debug.color = createDebug.selectColor(namespace);
          debug.extend = extend;
          debug.destroy = createDebug.destroy; // XXX Temporary. Will be removed in the next major release.

          Object.defineProperty(debug, "enabled", {
            enumerable: true,
            configurable: false,
            get: () => {
              if (enableOverride !== null) {
                return enableOverride;
              }
              if (namespacesCache !== createDebug.namespaces) {
                namespacesCache = createDebug.namespaces;
                enabledCache = createDebug.enabled(namespace);
              }

              return enabledCache;
            },
            set: (v) => {
              enableOverride = v;
            },
          });

          // Env-specific initialization logic for debug instances
          if (typeof createDebug.init === "function") {
            createDebug.init(debug);
          }

          return debug;
        }

        function extend(namespace, delimiter) {
          const newDebug = createDebug(
            this.namespace +
              (typeof delimiter === "undefined" ? ":" : delimiter) +
              namespace
          );
          newDebug.log = this.log;
          return newDebug;
        }

        /**
         * Enables a debug mode by namespaces. This can include modes
         * separated by a colon and wildcards.
         *
         * @param {String} namespaces
         * @api public
         */
        function enable(namespaces) {
          createDebug.save(namespaces);
          createDebug.namespaces = namespaces;

          createDebug.names = [];
          createDebug.skips = [];

          const split = (typeof namespaces === "string" ? namespaces : "")
            .trim()
            .replace(/\s+/g, ",")
            .split(",")
            .filter(Boolean);

          for (const ns of split) {
            if (ns[0] === "-") {
              createDebug.skips.push(ns.slice(1));
            } else {
              createDebug.names.push(ns);
            }
          }
        }

        /**
         * Checks if the given string matches a namespace template, honoring
         * asterisks as wildcards.
         *
         * @param {String} search
         * @param {String} template
         * @return {Boolean}
         */
        function matchesTemplate(search, template) {
          let searchIndex = 0;
          let templateIndex = 0;
          let starIndex = -1;
          let matchIndex = 0;

          while (searchIndex < search.length) {
            if (
              templateIndex < template.length &&
              (template[templateIndex] === search[searchIndex] ||
                template[templateIndex] === "*")
            ) {
              // Match character or proceed with wildcard
              if (template[templateIndex] === "*") {
                starIndex = templateIndex;
                matchIndex = searchIndex;
                templateIndex++; // Skip the '*'
              } else {
                searchIndex++;
                templateIndex++;
              }
            } else if (starIndex !== -1) {
              // eslint-disable-line no-negated-condition
              // Backtrack to the last '*' and try to match more characters
              templateIndex = starIndex + 1;
              matchIndex++;
              searchIndex = matchIndex;
            } else {
              return false; // No match
            }
          }

          // Handle trailing '*' in template
          while (
            templateIndex < template.length &&
            template[templateIndex] === "*"
          ) {
            templateIndex++;
          }

          return templateIndex === template.length;
        }

        /**
         * Disable debug output.
         *
         * @return {String} namespaces
         * @api public
         */
        function disable() {
          const namespaces = [
            ...createDebug.names,
            ...createDebug.skips.map((namespace) => "-" + namespace),
          ].join(",");
          createDebug.enable("");
          return namespaces;
        }

        /**
         * Returns true if the given mode name is enabled, false otherwise.
         *
         * @param {String} name
         * @return {Boolean}
         * @api public
         */
        function enabled(name) {
          for (const skip of createDebug.skips) {
            if (matchesTemplate(name, skip)) {
              return false;
            }
          }

          for (const ns of createDebug.names) {
            if (matchesTemplate(name, ns)) {
              return true;
            }
          }

          return false;
        }

        /**
         * Coerce `val`.
         *
         * @param {Mixed} val
         * @return {Mixed}
         * @api private
         */
        function coerce(val) {
          if (val instanceof Error) {
            return val.stack || val.message;
          }
          return val;
        }

        /**
         * XXX DO NOT USE. This is a temporary stub function.
         * XXX It WILL be removed in the next major release.
         */
        function destroy() {
          console.warn(
            "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
          );
        }

        createDebug.enable(createDebug.load());

        return createDebug;
      }

      module.exports = setup;

      /***/
    },
    /* 10 */
    /***/ (module) => {
      /**
       * Helpers.
       */

      var s = 1000;
      var m = s * 60;
      var h = m * 60;
      var d = h * 24;
      var w = d * 7;
      var y = d * 365.25;

      /**
       * Parse or format the given `val`.
       *
       * Options:
       *
       *  - `long` verbose formatting [false]
       *
       * @param {String|Number} val
       * @param {Object} [options]
       * @throws {Error} throw an error if val is not a non-empty string or a number
       * @return {String|Number}
       * @api public
       */

      module.exports = function (val, options) {
        options = options || {};
        var type = typeof val;
        if (type === "string" && val.length > 0) {
          return parse(val);
        } else if (type === "number" && isFinite(val)) {
          return options.long ? fmtLong(val) : fmtShort(val);
        }
        throw new Error(
          "val is not a non-empty string or a valid number. val=" +
            JSON.stringify(val)
        );
      };

      /**
       * Parse the given `str` and return milliseconds.
       *
       * @param {String} str
       * @return {Number}
       * @api private
       */

      function parse(str) {
        str = String(str);
        if (str.length > 100) {
          return;
        }
        var match =
          /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
            str
          );
        if (!match) {
          return;
        }
        var n = parseFloat(match[1]);
        var type = (match[2] || "ms").toLowerCase();
        switch (type) {
          case "years":
          case "year":
          case "yrs":
          case "yr":
          case "y":
            return n * y;
          case "weeks":
          case "week":
          case "w":
            return n * w;
          case "days":
          case "day":
          case "d":
            return n * d;
          case "hours":
          case "hour":
          case "hrs":
          case "hr":
          case "h":
            return n * h;
          case "minutes":
          case "minute":
          case "mins":
          case "min":
          case "m":
            return n * m;
          case "seconds":
          case "second":
          case "secs":
          case "sec":
          case "s":
            return n * s;
          case "milliseconds":
          case "millisecond":
          case "msecs":
          case "msec":
          case "ms":
            return n;
          default:
            return undefined;
        }
      }

      /**
       * Short format for `ms`.
       *
       * @param {Number} ms
       * @return {String}
       * @api private
       */

      function fmtShort(ms) {
        var msAbs = Math.abs(ms);
        if (msAbs >= d) {
          return Math.round(ms / d) + "d";
        }
        if (msAbs >= h) {
          return Math.round(ms / h) + "h";
        }
        if (msAbs >= m) {
          return Math.round(ms / m) + "m";
        }
        if (msAbs >= s) {
          return Math.round(ms / s) + "s";
        }
        return ms + "ms";
      }

      /**
       * Long format for `ms`.
       *
       * @param {Number} ms
       * @return {String}
       * @api private
       */

      function fmtLong(ms) {
        var msAbs = Math.abs(ms);
        if (msAbs >= d) {
          return plural(ms, msAbs, d, "day");
        }
        if (msAbs >= h) {
          return plural(ms, msAbs, h, "hour");
        }
        if (msAbs >= m) {
          return plural(ms, msAbs, m, "minute");
        }
        if (msAbs >= s) {
          return plural(ms, msAbs, s, "second");
        }
        return ms + " ms";
      }

      /**
       * Pluralization helper.
       */

      function plural(ms, msAbs, n, name) {
        var isPlural = msAbs >= n * 1.5;
        return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
      }

      /***/
    },
    /* 11 */
    /***/ (module, exports, __webpack_require__) => {
      /**
       * Module dependencies.
       */

      const tty = __webpack_require__(12);
      const util = __webpack_require__(13);

      /**
       * This is the Node.js implementation of `debug()`.
       */

      exports.init = init;
      exports.log = log;
      exports.formatArgs = formatArgs;
      exports.save = save;
      exports.load = load;
      exports.useColors = useColors;
      exports.destroy = util.deprecate(() => {},
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");

      /**
       * Colors.
       */

      exports.colors = [6, 2, 3, 4, 5, 1];

      try {
        // Optional dependency (as in, doesn't need to be installed, NOT like optionalDependencies in package.json)
        // eslint-disable-next-line import/no-extraneous-dependencies
        const supportsColor = __webpack_require__(14);

        if (
          supportsColor &&
          (supportsColor.stderr || supportsColor).level >= 2
        ) {
          exports.colors = [
            20, 21, 26, 27, 32, 33, 38, 39, 40, 41, 42, 43, 44, 45, 56, 57, 62,
            63, 68, 69, 74, 75, 76, 77, 78, 79, 80, 81, 92, 93, 98, 99, 112,
            113, 128, 129, 134, 135, 148, 149, 160, 161, 162, 163, 164, 165,
            166, 167, 168, 169, 170, 171, 172, 173, 178, 179, 184, 185, 196,
            197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209,
            214, 215, 220, 221,
          ];
        }
      } catch (error) {
        // Swallow - we only care if `supports-color` is available; it doesn't have to be.
      }

      /**
       * Build up the default `inspectOpts` object from the environment variables.
       *
       *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
       */

      exports.inspectOpts = Object.keys(process.env)
        .filter((key) => {
          return /^debug_/i.test(key);
        })
        .reduce((obj, key) => {
          // Camel-case
          const prop = key
            .substring(6)
            .toLowerCase()
            .replace(/_([a-z])/g, (_, k) => {
              return k.toUpperCase();
            });

          // Coerce string value into JS value
          let val = process.env[key];
          if (/^(yes|on|true|enabled)$/i.test(val)) {
            val = true;
          } else if (/^(no|off|false|disabled)$/i.test(val)) {
            val = false;
          } else if (val === "null") {
            val = null;
          } else {
            val = Number(val);
          }

          obj[prop] = val;
          return obj;
        }, {});

      /**
       * Is stdout a TTY? Colored output is enabled when `true`.
       */

      function useColors() {
        return "colors" in exports.inspectOpts
          ? Boolean(exports.inspectOpts.colors)
          : tty.isatty(process.stderr.fd);
      }

      /**
       * Adds ANSI color escape codes if enabled.
       *
       * @api public
       */

      function formatArgs(args) {
        const { namespace: name, useColors } = this;

        if (useColors) {
          const c = this.color;
          const colorCode = "\u001B[3" + (c < 8 ? c : "8;5;" + c);
          const prefix = `  ${colorCode};1m${name} \u001B[0m`;

          args[0] = prefix + args[0].split("\n").join("\n" + prefix);
          args.push(
            colorCode + "m+" + module.exports.humanize(this.diff) + "\u001B[0m"
          );
        } else {
          args[0] = getDate() + name + " " + args[0];
        }
      }

      function getDate() {
        if (exports.inspectOpts.hideDate) {
          return "";
        }
        return new Date().toISOString() + " ";
      }

      /**
       * Invokes `util.formatWithOptions()` with the specified arguments and writes to stderr.
       */

      function log(...args) {
        return process.stderr.write(
          util.formatWithOptions(exports.inspectOpts, ...args) + "\n"
        );
      }

      /**
       * Save `namespaces`.
       *
       * @param {String} namespaces
       * @api private
       */
      function save(namespaces) {
        if (namespaces) {
          process.env.DEBUG = namespaces;
        } else {
          // If you set a process.env field to null or undefined, it gets cast to the
          // string 'null' or 'undefined'. Just delete instead.
          delete process.env.DEBUG;
        }
      }

      /**
       * Load `namespaces`.
       *
       * @return {String} returns the previously persisted debug modes
       * @api private
       */

      function load() {
        return process.env.DEBUG;
      }

      /**
       * Init logic for `debug` instances.
       *
       * Create a new `inspectOpts` object in case `useColors` is set
       * differently for a particular `debug` instance.
       */

      function init(debug) {
        debug.inspectOpts = {};

        const keys = Object.keys(exports.inspectOpts);
        for (let i = 0; i < keys.length; i++) {
          debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
        }
      }

      module.exports = __webpack_require__(9)(exports);

      const { formatters } = module.exports;

      /**
       * Map %o to `util.inspect()`, all on a single line.
       */

      formatters.o = function (v) {
        this.inspectOpts.colors = this.useColors;
        return util
          .inspect(v, this.inspectOpts)
          .split("\n")
          .map((str) => str.trim())
          .join(" ");
      };

      /**
       * Map %O to `util.inspect()`, allowing multiple lines if needed.
       */

      formatters.O = function (v) {
        this.inspectOpts.colors = this.useColors;
        return util.inspect(v, this.inspectOpts);
      };

      /***/
    },
    /* 12 */
    /***/ (module) => {
      "use strict";
      module.exports = require("tty");

      /***/
    },
    /* 13 */
    /***/ (module) => {
      "use strict";
      module.exports = require("util");

      /***/
    },
    /* 14 */
    /***/ (
      __unused_webpack___webpack_module__,
      __webpack_exports__,
      __webpack_require__
    ) => {
      "use strict";
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ createSupportsColor: () =>
          /* binding */ createSupportsColor,
        /* harmony export */ default: () => __WEBPACK_DEFAULT_EXPORT__,
        /* harmony export */
      });
      /* harmony import */ var node_process__WEBPACK_IMPORTED_MODULE_0__ =
        __webpack_require__(15);
      /* harmony import */ var node_os__WEBPACK_IMPORTED_MODULE_1__ =
        __webpack_require__(16);
      /* harmony import */ var node_tty__WEBPACK_IMPORTED_MODULE_2__ =
        __webpack_require__(17);

      // From: https://github.com/sindresorhus/has-flag/blob/main/index.js
      /// function hasFlag(flag, argv = globalThis.Deno?.args ?? process.argv) {
      function hasFlag(
        flag,
        argv = globalThis.Deno
          ? globalThis.Deno.args
          : node_process__WEBPACK_IMPORTED_MODULE_0__.argv
      ) {
        const prefix = flag.startsWith("-")
          ? ""
          : flag.length === 1
          ? "-"
          : "--";
        const position = argv.indexOf(prefix + flag);
        const terminatorPosition = argv.indexOf("--");
        return (
          position !== -1 &&
          (terminatorPosition === -1 || position < terminatorPosition)
        );
      }

      const { env } = node_process__WEBPACK_IMPORTED_MODULE_0__;

      let flagForceColor;
      if (
        hasFlag("no-color") ||
        hasFlag("no-colors") ||
        hasFlag("color=false") ||
        hasFlag("color=never")
      ) {
        flagForceColor = 0;
      } else if (
        hasFlag("color") ||
        hasFlag("colors") ||
        hasFlag("color=true") ||
        hasFlag("color=always")
      ) {
        flagForceColor = 1;
      }

      function envForceColor() {
        if (!("FORCE_COLOR" in env)) {
          return;
        }

        if (env.FORCE_COLOR === "true") {
          return 1;
        }

        if (env.FORCE_COLOR === "false") {
          return 0;
        }

        if (env.FORCE_COLOR.length === 0) {
          return 1;
        }

        const level = Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);

        if (![0, 1, 2, 3].includes(level)) {
          return;
        }

        return level;
      }

      function translateLevel(level) {
        if (level === 0) {
          return false;
        }

        return {
          level,
          hasBasic: true,
          has256: level >= 2,
          has16m: level >= 3,
        };
      }

      function _supportsColor(
        haveStream,
        { streamIsTTY, sniffFlags = true } = {}
      ) {
        const noFlagForceColor = envForceColor();
        if (noFlagForceColor !== undefined) {
          flagForceColor = noFlagForceColor;
        }

        const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;

        if (forceColor === 0) {
          return 0;
        }

        if (sniffFlags) {
          if (
            hasFlag("color=16m") ||
            hasFlag("color=full") ||
            hasFlag("color=truecolor")
          ) {
            return 3;
          }

          if (hasFlag("color=256")) {
            return 2;
          }
        }

        // Check for Azure DevOps pipelines.
        // Has to be above the `!streamIsTTY` check.
        if ("TF_BUILD" in env && "AGENT_NAME" in env) {
          return 1;
        }

        if (haveStream && !streamIsTTY && forceColor === undefined) {
          return 0;
        }

        const min = forceColor || 0;

        if (env.TERM === "dumb") {
          return min;
        }

        if (node_process__WEBPACK_IMPORTED_MODULE_0__.platform === "win32") {
          // Windows 10 build 10586 is the first Windows release that supports 256 colors.
          // Windows 10 build 14931 is the first release that supports 16m/TrueColor.
          const osRelease = node_os__WEBPACK_IMPORTED_MODULE_1__
            .release()
            .split(".");
          if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10_586) {
            return Number(osRelease[2]) >= 14_931 ? 3 : 2;
          }

          return 1;
        }

        if ("CI" in env) {
          if (
            ["GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI"].some(
              (key) => key in env
            )
          ) {
            return 3;
          }

          if (
            ["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some(
              (sign) => sign in env
            ) ||
            env.CI_NAME === "codeship"
          ) {
            return 1;
          }

          return min;
        }

        if ("TEAMCITY_VERSION" in env) {
          return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION)
            ? 1
            : 0;
        }

        if (env.COLORTERM === "truecolor") {
          return 3;
        }

        if (env.TERM === "xterm-kitty") {
          return 3;
        }

        if (env.TERM === "xterm-ghostty") {
          return 3;
        }

        if (env.TERM === "wezterm") {
          return 3;
        }

        if ("TERM_PROGRAM" in env) {
          const version = Number.parseInt(
            (env.TERM_PROGRAM_VERSION || "").split(".")[0],
            10
          );

          switch (env.TERM_PROGRAM) {
            case "iTerm.app": {
              return version >= 3 ? 3 : 2;
            }

            case "Apple_Terminal": {
              return 2;
            }
            // No default
          }
        }

        if (/-256(color)?$/i.test(env.TERM)) {
          return 2;
        }

        if (
          /^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(
            env.TERM
          )
        ) {
          return 1;
        }

        if ("COLORTERM" in env) {
          return 1;
        }

        return min;
      }

      function createSupportsColor(stream, options = {}) {
        const level = _supportsColor(stream, {
          streamIsTTY: stream && stream.isTTY,
          ...options,
        });

        return translateLevel(level);
      }

      const supportsColor = {
        stdout: createSupportsColor({
          isTTY: node_tty__WEBPACK_IMPORTED_MODULE_2__.isatty(1),
        }),
        stderr: createSupportsColor({
          isTTY: node_tty__WEBPACK_IMPORTED_MODULE_2__.isatty(2),
        }),
      };

      /* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ =
        supportsColor;

      /***/
    },
    /* 15 */
    /***/ (module) => {
      "use strict";
      module.exports = require("node:process");

      /***/
    },
    /* 16 */
    /***/ (module) => {
      "use strict";
      module.exports = require("node:os");

      /***/
    },
    /* 17 */
    /***/ (module) => {
      "use strict";
      module.exports = require("node:tty");

      /***/
    },
    /******/
  ];
  /************************************************************************/
  /******/ // The module cache
  /******/ var __webpack_module_cache__ = {};
  /******/
  /******/ // The require function
  /******/ function __webpack_require__(moduleId) {
    /******/ // Check if module is in cache
    /******/ var cachedModule = __webpack_module_cache__[moduleId];
    /******/ if (cachedModule !== undefined) {
      /******/ return cachedModule.exports;
      /******/
    }
    /******/ // Create a new module (and put it into the cache)
    /******/ var module = (__webpack_module_cache__[moduleId] = {
      /******/ // no module.id needed
      /******/ // no module.loaded needed
      /******/ exports: {},
      /******/
    });
    /******/
    /******/ // Execute the module function
    /******/ __webpack_modules__[moduleId].call(
      module.exports,
      module,
      module.exports,
      __webpack_require__
    );
    /******/
    /******/ // Return the exports of the module
    /******/ return module.exports;
    /******/
  }
  /******/
  /************************************************************************/
  /******/ /* webpack/runtime/define property getters */
  /******/ (() => {
    /******/ // define getter functions for harmony exports
    /******/ __webpack_require__.d = (exports, definition) => {
      /******/ for (var key in definition) {
        /******/ if (
          __webpack_require__.o(definition, key) &&
          !__webpack_require__.o(exports, key)
        ) {
          /******/ Object.defineProperty(exports, key, {
            enumerable: true,
            get: definition[key],
          });
          /******/
        }
        /******/
      }
      /******/
    };
    /******/
  })();
  /******/
  /******/ /* webpack/runtime/hasOwnProperty shorthand */
  /******/ (() => {
    /******/ __webpack_require__.o = (obj, prop) =>
      Object.prototype.hasOwnProperty.call(obj, prop);
    /******/
  })();
  /******/
  /******/ /* webpack/runtime/make namespace object */
  /******/ (() => {
    /******/ // define __esModule on exports
    /******/ __webpack_require__.r = (exports) => {
      /******/ if (typeof Symbol !== "undefined" && Symbol.toStringTag) {
        /******/ Object.defineProperty(exports, Symbol.toStringTag, {
          value: "Module",
        });
        /******/
      }
      /******/ Object.defineProperty(exports, "__esModule", { value: true });
      /******/
    };
    /******/
  })();
  /******/
  /************************************************************************/
  /******/
  /******/ // startup
  /******/ // Load entry module and return exports
  /******/ // This entry module is referenced by other modules so it can't be inlined
  /******/ var __webpack_exports__ = __webpack_require__(0);
  /******/ module.exports = __webpack_exports__;
  /******/
  /******/
})();
//# sourceMappingURL=extension.js.map
