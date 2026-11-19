"use strict";

(function () {
	const SAMPLE = [
		"// Calculate the order total",
		"function calculateTotal(items) {",
		"\tvar total = 0;",
		"\tfor (var i = 0; i < items.length; i++) {",
		"\t\tvar item = items[i];",
		"\t\tif (item.price > 0) {",
		"\t\t\ttotal += item.price * item.quantity;",
		"\t\t} else {",
		"\t\t\tconsole.warn(\"Invalid price\", item);",
		"\t\t}",
		"\t}",
		"\treturn total;",
		"}",
		"",
		"var orders = [",
		"\t{ name: \"Keyboard\", price: 299, quantity: 2 },",
		"\t{ name: \"Mouse\", price: 99, quantity: 1 }",
		"];",
		"",
		"console.log(\"Order total: \" + calculateTotal(orders));"
	].join("\n");

	const TARGET_BROWSERS = {
		es5: { ie: "11" },
		es2015: { chrome: "51" },
		es2016: { chrome: "52" },
		es2017: { chrome: "58" },
		es2018: { chrome: "64" },
		es2019: { chrome: "75" },
		es2020: { chrome: "85" },
		es2021: { chrome: "90" },
		es2022: { chrome: "94" }
	};

	let transpiler_promise = null;

	function load_transpiler() {
		if (window.Babel) return Promise.resolve(window.Babel);
		if (transpiler_promise) return transpiler_promise;

		transpiler_promise = new Promise(function (resolve, reject) {
			const script = document.createElement("script");
			script.src = "babel-standalone.js";
			script.onload = function () {
				if (window.Babel) resolve(window.Babel);
				else reject(new Error("Babel did not initialize correctly"));
			};
			script.onerror = function () {
				reject(new Error("Unable to load babel-standalone.js"));
			};
			document.head.appendChild(script);
		});

		return transpiler_promise;
	}

	function transpile_source(source, target, want_map) {
		const Babel = window.Babel;
		const result = Babel.transform(source, {
			presets: [
				[
					"env",
					{
						targets: TARGET_BROWSERS[target],
						modules: false,
						bugfixes: true
					}
				]
			],
			sourceType: "unambiguous",
			filename: "input.js",
			sourceMaps: Boolean(want_map),
			comments: true,
			compact: false
		});

		return {
			code: result.code,
			map: result.map || null
		};
	}

	const STORAGE_THEME = "jshaman-jsminify-theme";

	const el = {};
	let lastResult = null;
	let running = false;

	function byId(id) {
		return document.getElementById(id);
	}

	function bytes(text) {
		if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).length;
		return new Blob([text]).size;
	}

	function formatBytes(size) {
		if (!size) return "0 B";
		if (size < 1024) return size + " B";
		if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
		return (size / (1024 * 1024)).toFixed(2) + " MB";
	}

	function count(text) {
		return text.length.toLocaleString("en-US") + " characters";
	}

	function setMessage(text, kind) {
		if (!text) {
			el.message.hidden = true;
			el.message.textContent = "";
			return;
		}

		el.message.hidden = false;
		el.message.className = "message" + (kind === "error" ? " error" : "");
		el.message.textContent = text;
	}

	let toast_timer = null;

	function showToast(text, is_error) {
		const toast = document.getElementById("toast");
		if (!toast) return;

		toast.textContent = text;
		toast.hidden = false;
		toast.classList.toggle("error", Boolean(is_error));

		window.requestAnimationFrame(function () {
			toast.classList.add("show");
		});

		window.clearTimeout(toast_timer);
		toast_timer = window.setTimeout(function () {
			toast.classList.remove("show");
			window.setTimeout(function () {
				toast.hidden = true;
			}, 250);
		}, 1800);
	}

	function splitNames(text) {
		return String(text || "")
			.split(",")
			.map(function (item) {
				return item.trim();
			})
			.filter(Boolean);
	}

	function numberValue(input, fallback) {
		const value = Number(input.value);
		return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
	}

	function readOptions(input_map) {
		const toplevel = el.optToplevel.checked;
		const reserved = splitNames(el.optReserved.value);

		const compress = {
			toplevel: toplevel,
			unused: el.optUnused.checked,
			unused_toplevel_functions: el.optUnusedToplevel.checked,
			unused_toplevel_variables: el.optUnusedToplevel.checked,
			inline: el.optInline.checked,
			hoist_funs: el.optHoistFuns.checked,
			hoist_vars: el.optHoistVars.checked,
			keep_fargs: el.optKeepFargs.checked,
			booleans: el.optBooleans.checked,
			unsafe_undefined: el.optUnsafeUndefined.checked,
			unsafe_math: el.optUnsafeMath.checked,
			unsafe_proto: el.optUnsafeProto.checked,
			unsafe_regexp: el.optUnsafeRegexp.checked,
			pure_getters: el.optPureGetters.checked,
			arrows: el.optArrows.checked,
			drop_console: el.optConsole.checked,
			drop_debugger: el.optDebugger.checked,
			passes: Math.max(1, numberValue(el.optPasses, 1)),
			dead_code: el.optDeadCode.checked,
			side_effects: el.optSideEffects.checked,
			join_vars: el.optJoinVars.checked,
			sequences: el.optSequences.checked,
			if_return: el.optIfReturn.checked,
			assignments: el.optAssignments.checked,
			directives: el.optDirectives.checked,
			loops: el.optLoops.checked,
			switches: el.optSwitches.checked,
			arguments: el.optArguments.checked,
			properties: el.optPropertySimplify.checked,
			empty_statement: el.optEmptyStatement.checked,
			conditionals: el.optConditionals.checked,
			inline_literals: el.optInlineLiterals.checked,
			collapse_vars: el.optCollapseVars.checked,
			reduce_vars: el.optReduceVars.checked,
			evaluate: el.optEvaluate.checked,
			pure_funcs: splitNames(el.optPureFuncs.value)
		};

		const mangle = el.optMangle.checked
			? {
					variables: true,
					functions: true,
					toplevel: toplevel,
					keep_classnames: el.optKeepClassnames.checked,
					reserved: reserved,
					properties: el.optMangleProps.checked
						? {
								reserved: reserved,
								keep_quoted: el.optKeepQuoted.checked,
								regex: el.optPropsRegex.value.trim() || null
							}
						: false
				}
			: false;

		const comments = el.optComments.checked ? false : el.optCommentsMode.value === "some" ? "some" : true;

		const output = {
			comments: comments,
			beautify: el.optBeautify.checked,
			ascii_only: el.optAsciiOnly.checked,
			inline_script: el.optInlineScript.checked,
			shebang: el.optShebang.checked,
			preserve_line: el.optPreserveLine.checked,
			braces: el.optBraces.checked,
			quote_keys: el.optQuoteKeys.checked,
			keep_quoted_props: el.optKeepQuotedProps.checked,
			semicolons: !el.optSemicolons.checked,
			wrap_iife: el.optWrapIife.checked,
			max_line_len: numberValue(el.optWidth, 0),
			indent_start: numberValue(el.optIndentStart, 0),
			indent_level: numberValue(el.optIndentLevel, 0),
			preamble: el.optPreamble.value
		};

		if (el.optQuoteStyle.value !== "default") output.quote_style = el.optQuoteStyle.value;

		const options = {
			compress: compress,
			mangle: mangle,
			output: output,
			parse: {
				sourceType: el.optSourceType.value,
				plugins: splitNames(el.optPlugins.value),
				expression: el.optExpression.checked
			},
			report: el.optReport.checked,
			ie8: el.optIe8.checked,
			safari10: el.optSafari10.checked,
			webkit: el.optWebkit.checked
		};

		if (el.optSourceMap.checked) {
			options.sourceMap = {
				filename: "output.min.js",
				url: el.optMapInline.checked ? false : el.optMapUrl.value.trim() || false,
				inline: el.optMapInline.checked,
				includeSources: el.optMapSources.checked
			};

			if (input_map) options.sourceMap.content = input_map;
		}

		return options;
	}

	function updateCounts() {
		el.inputCount.textContent = count(el.jsInput.value);
		if (lastResult) el.outputCount.textContent = count(el.jsOutput.value);
	}

	function translate_report(text) {
		return String(text)
			.replace(/^删除 debugger 语句$/, "Removed debugger statement")
			.replace(/^删除 console 调用：(.+)$/, "Removed console call: $1")
			.replace(/^删除不可达代码：(\d+) 条语句$/, "Removed unreachable code: $1 statements")
			.replace(/^删除无副作用的语句$/, "Removed side-effect-free statement")
			.replace(/^函数声明提升：(\d+) 个$/, "Hoisted $1 function declarations")
			.replace(/^变量声明提升：(\d+) 个$/, "Hoisted $1 var declarations")
			.replace(/^undefined 替换为 void 0$/, "Replaced undefined with void 0")
			.replace(/^unsafe_math：Math\.pow\(x, (.+)\) 改为乘法$/, "unsafe_math: Math.pow(x, $1) -> multiplication")
			.replace(/^unsafe_math：x \*\* 2 改为 x \* x$/, "unsafe_math: x ** 2 -> x * x")
			.replace(/^unsafe_proto：Array\.prototype\.(.+) 改为 \[\]\.(.+)$/, "unsafe_proto: Array.prototype.$1 -> [].$2")
			.replace(/^unsafe_regexp：RegExp 构造改为正则字面量$/, "unsafe_regexp: RegExp constructor -> regex literal")
			.replace(/^switch 改成 if$/, "Rewrote switch as if")
			.replace(/^函数表达式转箭头函数$/, "Converted function expression to arrow function")
			.replace(/^内联函数：(.+)$/, "Inlined function: $1")
			.replace(/^arguments 下标改写：(\d+) 处$/, "Rewrote arguments indexes: $1 occurrences")
			.replace(/^删除未使用的全局函数：(.+)$/, "Removed unused global function: $1")
			.replace(/^删除未使用的局部函数：(.+)$/, "Removed unused local function: $1")
			.replace(/^删除未使用的全局变量：(.+)$/, "Removed unused global variable: $1")
			.replace(/^删除未使用的局部变量：(.+)$/, "Removed unused local variable: $1")
			.replace(/^变量内联：(.+)$/, "Inlined variable: $1")
			.replace(/^变量传播：(.+)$/, "Propagated variable: $1")
			.replace(/^名称改写：(.+) -> (.+)$/, "Renamed: $1 -> $2")
			.replace(/^属性名改写：(.+) -> (.+)$/, "Renamed property: $1 -> $2")
			.replace(/^立即执行函数加括号$/, "Wrapped IIFE in parentheses");
	}

	function translate_warning(text) {
		const message = String(text);

		if (message.indexOf("同时使用 sourceMap 与 indent_start/indent_level") !== -1) {
			return "sourceMap with indent_start/indent_level can break mappings; indentation options were ignored.";
		}
		if (message.indexOf("同时使用 inline_script 与 sourceMap") !== -1) {
			return "inline_script with sourceMap can shift columns; mappings may be slightly off.";
		}
		if (message.indexOf("同时使用 sourceMap 与 max_line_len") !== -1) {
			return "sourceMap with max_line_len can break mappings; max_line_len was ignored.";
		}
		if (message.indexOf("同时使用 sourceMap 与 semicolons=false") !== -1) {
			return "sourceMap with semicolons=false can break mappings; semicolons=false was ignored.";
		}
		if (message.indexOf("检测到 eval 或 with") !== -1) {
			return "eval or with detected: scope-dependent compression and mangling were disabled.";
		}
		if (message.indexOf("未在源码中找到内联 source map") !== -1) {
			return "No inline source map found in the input; sourceMap.content=inline was ignored.";
		}

		return message;
	}

	function renderReports(reports) {
		el.reportsList.textContent = "";

		if (!reports || reports.length === 0) {
			el.reportsBox.hidden = true;
			return;
		}

		const limit = Math.min(reports.length, 300);

		for (let index = 0; index < limit; index++) {
			const item = document.createElement("li");
			item.textContent = translate_report(reports[index]);
			el.reportsList.appendChild(item);
		}

		if (reports.length > limit) {
			const more = document.createElement("li");
			more.textContent = "…and " + (reports.length - limit) + " more";
			el.reportsList.appendChild(more);
		}

		el.reportCount.textContent = "(" + reports.length + ")";
		el.reportsBox.hidden = false;
	}

	function hideResult() {
		lastResult = null;
		el.resultSection.hidden = true;
		el.outputCount.textContent = "0 characters";
	}

	function errorText(error) {
		if (!error) return "Unknown error";
		let text = error.message || String(error);
		if (error.loc && typeof error.loc.line === "number") {
			text += " (line " + error.loc.line + ", column " + (error.loc.column + 1) + ")";
		}
		return text;
	}

	function finish_run(result, source, started) {
		running = false;
		el.minifyBtn.disabled = false;
		el.minifyBtn.textContent = "Minify JavaScript";

		if (result.error) {
			hideResult();
			setMessage("Minification failed: " + errorText(result.error), "error");
			return;
		}

		const finished = window.performance && performance.now ? performance.now() : Date.now();
		const original = bytes(source);
		const minified = bytes(result.code);
		const saved = original > 0 ? Math.max(0, Math.round((1 - minified / original) * 1000) / 10) : 0;
		const elapsed = Math.max(0, Math.round(finished - started));

		lastResult = result;
		el.resultSection.hidden = false;
		el.origSize.textContent = formatBytes(original);
		el.compSize.textContent = formatBytes(minified);
		el.savingPct.textContent = saved + "%";
		el.costTime.textContent = elapsed + " ms";
		el.barLabel.textContent = saved + "%";
		el.compBar.style.width = Math.min(100, saved) + "%";
		el.jsOutput.value = result.code;
		el.outputCount.textContent = count(result.code);
		el.downloadBtn.disabled = false;
		el.downloadMapBtn.disabled = !result.map;

		renderReports(result.reports);

		if (result.warnings && result.warnings.length > 0) {
			setMessage(result.warnings.slice(0, 3).map(translate_warning).join("\n"), "error");
		} else {
			setMessage("");
		}

		window.setTimeout(function () {
			if (el.resultSection.scrollIntoView) {
				el.resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		}, 50);
	}

	function fail_run(error) {
		running = false;
		el.minifyBtn.disabled = false;
		el.minifyBtn.textContent = "Minify JavaScript";
		hideResult();
		setMessage("Minification failed: " + errorText(error), "error");
	}

	function run() {
		if (running) return;

		const source = el.jsInput.value;

		if (!source.trim()) {
			setMessage("Please enter JavaScript code to minify.", "error");
			el.jsInput.focus();
			return;
		}

		if (typeof window.JShamanJSMinify === "undefined") {
			setMessage("The minifier failed to load. Make sure jsminify.browser.js is available.", "error");
			return;
		}

		const target = el.optTarget.value;
		const wants_map = el.optSourceMap.checked;

		running = true;
		el.minifyBtn.disabled = true;
		el.minifyBtn.textContent = "Minifying…";
		setMessage(target !== "esnext" ? "Preparing the ES transformer…" : "");

		window.setTimeout(function () {
			const started = window.performance && performance.now ? performance.now() : Date.now();

			const prepared =
				target === "esnext"
					? Promise.resolve(null)
					: load_transpiler().then(function () {
							setMessage("Transpiling to " + target.toUpperCase() + "…");
							return transpile_source(source, target, wants_map);
						});

			prepared
				.then(function (transformed) {
					let result;

					try {
						result = window.JShamanJSMinify.minify(
							transformed ? transformed.code : source,
							readOptions(transformed ? transformed.map : null)
						);
					} catch (error) {
						fail_run(error);
						return;
					}

					finish_run(result, source, started);
				})
				.catch(function (error) {
					fail_run(error);
				});
		}, 30);
	}

	function applyDefaults() {
		el.optComments.checked = true;
		el.optConsole.checked = false;
		el.optDebugger.checked = true;
		el.optSemicolons.checked = false;
		el.optMangle.checked = true;
		el.optUnused.checked = true;
		el.optReport.checked = true;

		el.optToplevel.checked = false;
		el.optUnusedToplevel.checked = false;
		el.optInline.checked = true;
		el.optHoistFuns.checked = false;
		el.optHoistVars.checked = false;
		el.optKeepFargs.checked = true;
		el.optBooleans.checked = true;
		el.optUnsafeUndefined.checked = false;
		el.optUnsafeMath.checked = false;
		el.optUnsafeProto.checked = false;
		el.optUnsafeRegexp.checked = false;
		el.optPureGetters.checked = false;
		el.optArrows.checked = false;
		el.optPasses.value = "2";
		el.optDeadCode.checked = true;
		el.optSideEffects.checked = true;
		el.optJoinVars.checked = true;
		el.optSequences.checked = true;
		el.optIfReturn.checked = true;
		el.optAssignments.checked = true;
		el.optDirectives.checked = true;
		el.optLoops.checked = true;
		el.optSwitches.checked = true;
		el.optArguments.checked = true;
		el.optPropertySimplify.checked = true;
		el.optEmptyStatement.checked = true;
		el.optConditionals.checked = true;
		el.optInlineLiterals.checked = true;
		el.optCollapseVars.checked = true;
		el.optReduceVars.checked = true;
		el.optEvaluate.checked = true;
		el.optPureFuncs.value = "";

		el.optKeepClassnames.checked = false;
		el.optMangleProps.checked = false;
		el.optPropsRegex.value = "^_";
		el.optReserved.value = "";
		el.optKeepQuoted.checked = true;

		el.optBeautify.checked = false;
		el.optCommentsMode.value = "none";
		el.optQuoteStyle.value = "default";
		el.optTarget.value = "esnext";
		el.optWidth.value = "0";
		el.optIndentStart.value = "0";
		el.optIndentLevel.value = "0";
		el.optPreamble.value = "";
		el.optWrapIife.checked = false;
		el.optAsciiOnly.checked = false;
		el.optInlineScript.checked = false;
		el.optShebang.checked = true;
		el.optPreserveLine.checked = false;
		el.optBraces.checked = false;
		el.optQuoteKeys.checked = false;
		el.optKeepQuotedProps.checked = false;

		el.optIe8.checked = false;
		el.optSafari10.checked = false;
		el.optWebkit.checked = false;

		el.optSourceMap.checked = false;
		el.optMapUrl.value = "output.min.js.map";
		el.optMapInline.checked = false;
		el.optMapSources.checked = true;

		el.optSourceType.value = "unambiguous";
		el.optPlugins.value = "";
		el.optExpression.checked = false;

		syncDisabled();
	}

	function syncDisabled() {
		const props = el.optMangleProps.checked;
		el.optPropsRegex.disabled = !props;
		el.optKeepQuoted.disabled = !props;
		const propsGroup = el.optMangleProps.closest(".related-options");
		if (propsGroup) propsGroup.classList.toggle("is-disabled", !props);

		const map = el.optSourceMap.checked;
		el.optMapUrl.disabled = !map;
		el.optMapInline.disabled = !map;
		el.optMapSources.disabled = !map;
		const mapGroup = el.optSourceMap.closest(".related-options");
		if (mapGroup) mapGroup.classList.toggle("is-disabled", !map);
	}

	function loadSample() {
		el.jsInput.value = SAMPLE;
		updateCounts();
		hideResult();
		setMessage("Sample loaded. Click “Minify JavaScript” to run.");
	}

	function openFile(file) {
		if (!file) return;

		const reader = new FileReader();

		reader.onload = function () {
			el.jsInput.value = String(reader.result || "");
			updateCounts();
			hideResult();
			setMessage("File loaded. Click “Minify JavaScript” to run.");
		};

		reader.onerror = function () {
			setMessage("Failed to read file: " + errorText(reader.error), "error");
		};

		reader.readAsText(file, "utf-8");
	}

	function copyOutput() {
		if (!lastResult) return;

		const text = el.jsOutput.value;

		function done() {
			showToast("Copied to clipboard");
		}

		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).then(done, function () {
				el.jsOutput.select();
				document.execCommand("copy");
				done();
			});
			return;
		}

		el.jsOutput.select();
		document.execCommand("copy");
		done();
	}

	function download(filename, content, type) {
		const blob = new Blob([content], { type: type || "text/javascript;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");

		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		window.setTimeout(function () {
			URL.revokeObjectURL(url);
		}, 1000);
	}

	function downloadCode() {
		if (!lastResult) return;
		download("output.min.js", lastResult.code);
	}

	function downloadMap() {
		if (!lastResult || !lastResult.map) return;
		download("output.min.js.map", lastResult.map, "application/json;charset=utf-8");
	}

	function reset() {
		el.jsInput.value = "";
		applyDefaults();
		hideResult();
		setMessage("");
		updateCounts();
		el.jsInput.focus();
	}

	function init() {
		el.jsInput = byId("jsInput");
		el.inputCount = byId("inputCount");
		el.message = byId("message");
		el.minifyBtn = byId("minifyBtn");
		el.resultSection = byId("resultSection");
		el.origSize = byId("origSize");
		el.compSize = byId("compSize");
		el.savingPct = byId("savingPct");
		el.costTime = byId("costTime");
		el.compBar = byId("compBar");
		el.barLabel = byId("barLabel");
		el.jsOutput = byId("jsOutput");
		el.outputCount = byId("outputCount");
		el.downloadBtn = byId("downloadBtn");
		el.downloadMapBtn = byId("downloadMapBtn");
		el.reportsBox = byId("reportsBox");
		el.reportsList = byId("reportsList");
		el.reportCount = byId("reportCount");
		el.fileInput = byId("fileInput");

		for (const id of [
			"optComments", "optConsole", "optDebugger", "optSemicolons", "optMangle", "optUnused", "optReport",
			"optToplevel", "optUnusedToplevel", "optInline", "optHoistFuns", "optHoistVars", "optKeepFargs",
			"optBooleans", "optUnsafeUndefined", "optUnsafeMath", "optUnsafeProto", "optUnsafeRegexp",
			"optPureGetters", "optArrows", "optPasses", "optKeepClassnames", "optMangleProps", "optPropsRegex",
			"optReserved", "optKeepQuoted", "optBeautify", "optCommentsMode", "optQuoteStyle", "optTarget", "optWidth",
			"optIndentStart", "optIndentLevel", "optWrapIife", "optAsciiOnly", "optInlineScript", "optShebang",
			"optPreserveLine", "optBraces", "optQuoteKeys", "optKeepQuotedProps", "optIe8", "optSafari10",
			"optWebkit", "optSourceMap", "optMapUrl", "optMapInline", "optMapSources", "optWhitespace",
			"optDeadCode", "optSideEffects", "optJoinVars", "optSequences", "optIfReturn", "optAssignments",
			"optDirectives", "optLoops", "optSwitches", "optArguments", "optPropertySimplify", "optEmptyStatement",
			"optConditionals", "optInlineLiterals", "optCollapseVars", "optReduceVars", "optEvaluate", "optPureFuncs",
			"optPreamble", "optSourceType", "optPlugins", "optExpression"
		]) {
			if (!el[id]) el[id] = byId(id);
		}

		applyDefaults();

		el.minifyBtn.addEventListener("click", run);
		byId("resetBtn").addEventListener("click", reset);
		byId("sampleBtn").addEventListener("click", loadSample);
		byId("openFileBtn").addEventListener("click", function () {
			el.fileInput.click();
		});
		el.fileInput.addEventListener("change", function () {
			openFile(el.fileInput.files && el.fileInput.files[0]);
			el.fileInput.value = "";
		});

		byId("copyBtn").addEventListener("click", copyOutput);
		el.downloadBtn.addEventListener("click", downloadCode);
		el.downloadMapBtn.addEventListener("click", downloadMap);

		el.jsInput.addEventListener("input", updateCounts);
		el.jsInput.addEventListener("dragover", function (event) {
			event.preventDefault();
		});
		el.jsInput.addEventListener("drop", function (event) {
			event.preventDefault();
			openFile(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]);
		});

		el.optComments.addEventListener("change", function () {
			el.optCommentsMode.value = el.optComments.checked ? "none" : "all";
		});
		el.optCommentsMode.addEventListener("change", function () {
			el.optComments.checked = el.optCommentsMode.value === "none";
		});
		el.optMangleProps.addEventListener("change", syncDisabled);
		el.optSourceMap.addEventListener("change", syncDisabled);

		document.addEventListener("keydown", function (event) {
			if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
				event.preventDefault();
				run();
			}
		});

		const advancedToggle = byId("advancedToggle");
		const advancedOptions = byId("advancedOptions");
		const optionsGrid = byId("optionsGrid");
		const advancedLabel = byId("advancedLabel");

		advancedToggle.addEventListener("click", function () {
			const open = advancedOptions.classList.toggle("open");
			advancedToggle.classList.toggle("open", open);
			optionsGrid.classList.toggle("advanced-open", open);
			advancedLabel.textContent = open ? "Hide advanced options" : "Show advanced options";
			advancedToggle.setAttribute("aria-expanded", open ? "true" : "false");
		});

		const optionsCard = byId("optionsCard");
		const optionsCollapse = byId("optionsCollapse");
		const optionsCollapseLabel = byId("optionsCollapseLabel");

		optionsCollapse.addEventListener("click", function () {
			const collapsed = optionsCard.classList.toggle("collapsed");
			optionsCollapseLabel.textContent = collapsed ? "Expand options" : "Collapse options";
			optionsCollapse.setAttribute("aria-expanded", collapsed ? "false" : "true");
		});

		const configInput = byId("configInput");

		function collect_config() {
			const config = {
				tool: "jshaman-jsminify",
				version: 1,
				options: {}
			};

			const controls = optionsCard.querySelectorAll("input[id^='opt'], select[id^='opt']");

			for (const control of controls) {
				if (control.type === "checkbox") config.options[control.id] = control.checked;
				else config.options[control.id] = control.value;
			}

			return config;
		}

		function apply_config(raw) {
			const source = raw && raw.options ? raw.options : raw;

			if (!source || typeof source !== "object") {
				throw new Error("Invalid configuration file format");
			}

			let applied = 0;

			for (const key of Object.keys(source)) {
				const control = document.getElementById(key);
				if (!control || !optionsCard.contains(control)) continue;

				if (control.type === "checkbox") control.checked = Boolean(source[key]);
				else control.value = String(source[key]);

				applied++;
			}

			syncDisabled();
			el.optComments.checked = el.optCommentsMode.value === "none";
			showToast("Loaded " + applied + " settings");
		}

		byId("saveConfig").addEventListener("click", function () {
			download("jshaman-jsminify-options.json", JSON.stringify(collect_config(), null, 2), "application/json;charset=utf-8");
			showToast("Configuration file downloaded");
		});

		byId("loadConfig").addEventListener("click", function () {
			configInput.click();
		});

		configInput.addEventListener("change", function () {
			const file = configInput.files && configInput.files[0];
			if (!file) return;

			const reader = new FileReader();

			reader.onload = function () {
				try {
					apply_config(JSON.parse(String(reader.result || "{}")));
				} catch (error) {
					showToast("Failed to load configuration: " + (error.message || String(error)), true);
				}
			};

			reader.onerror = function () {
				showToast("Failed to read configuration file", true);
			};

			reader.readAsText(file, "utf-8");
			configInput.value = "";
		});

		const menuBtn = byId("menuBtn");
		const mobileNav = byId("mobileNav");

		menuBtn.addEventListener("click", function () {
			const open = mobileNav.classList.toggle("open");
			menuBtn.classList.toggle("open", open);
			menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
		});

		mobileNav.addEventListener("click", function (event) {
			if (event.target && event.target.tagName === "A") {
				mobileNav.classList.remove("open");
				menuBtn.classList.remove("open");
				menuBtn.setAttribute("aria-expanded", "false");
			}
		});

		const darkToggle = byId("darkToggle");

		try {
			if (window.localStorage.getItem(STORAGE_THEME) === "light") document.body.classList.add("light-mode");
		} catch (error) {
			// Ignore storage errors in private mode
		}

		darkToggle.addEventListener("click", function () {
			const light = document.body.classList.toggle("light-mode");
			try {
				window.localStorage.setItem(STORAGE_THEME, light ? "light" : "dark");
			} catch (error) {
				// Ignore
			}
		});

		for (const item of document.querySelectorAll(".faq-item")) {
			const question = item.querySelector(".faq-question");
			if (!question) continue;
			question.setAttribute("aria-expanded", "false");
			question.addEventListener("click", function () {
				const open = item.classList.toggle("open");
				question.setAttribute("aria-expanded", open ? "true" : "false");
			});
		}

		const spy_links = Array.from(document.querySelectorAll('nav.main-nav a[href^="#"], .mobile-nav a[href^="#"]'));
		const spy_sections = ["tool", "features", "how-to", "docs", "plugins", "faq", "about"]
			.map(function (id) { return document.getElementById(id); })
			.filter(Boolean);

		function update_active_nav() {
			if (spy_sections.length === 0) return;

			const offset = window.scrollY + 120;
			let current = spy_sections[0];

			for (const section of spy_sections) {
				const top = section.getBoundingClientRect().top + window.scrollY;
				if (top <= offset) current = section;
			}

			if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
				current = spy_sections[spy_sections.length - 1];
			}

			const active_href = "#" + current.id;

			for (const link of spy_links) {
				const active = link.getAttribute("href") === active_href;
				link.classList.toggle("active", active);
				if (active) link.setAttribute("aria-current", "location");
				else link.removeAttribute("aria-current");
			}
		}

		let scroll_ticking = false;

		window.addEventListener("scroll", function () {
			if (scroll_ticking) return;
			scroll_ticking = true;
			window.requestAnimationFrame(function () {
				update_active_nav();
				scroll_ticking = false;
			});
		}, { passive: true });

		window.addEventListener("resize", update_active_nav);
		update_active_nav();

		function open_hash_target() {
			const hash = window.location.hash;
			if (!hash || hash.length < 2) return;

			let target = null;

			try {
				target = document.getElementById(decodeURIComponent(hash.slice(1)));
			} catch (error) {
				return;
			}

			if (!target || !target.closest) return;

			const card = target.closest("details.doc-card");
			if (card && !card.open) {
				card.open = true;
				window.requestAnimationFrame(function () {
					target.scrollIntoView({ block: "start" });
				});
			}
		}

		window.addEventListener("hashchange", open_hash_target);
		open_hash_target();

		updateCounts();
		hideResult();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
