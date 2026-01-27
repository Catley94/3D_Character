"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
class WindowManager {
  mainWindow = null;
  MIN_WIDTH = 200;
  MIN_HEIGHT = 200;
  VITE_DEV_SERVER_URL;
  constructor() {
    this.VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
  }
  getDistPath() {
    if (electron.app.isPackaged) {
      return path.join(process.resourcesPath, "app.asar", "dist");
    }
    return path.join(__dirname, "../../dist");
  }
  getPreloadPath() {
    if (electron.app.isPackaged) {
      return path.join(process.resourcesPath, "app.asar", "dist-electron", "preload.js");
    }
    return path.join(__dirname, "preload.js");
  }
  createMainWindow() {
    const display = electron.screen.getPrimaryDisplay();
    const { width, height } = display.bounds;
    this.mainWindow = new electron.BrowserWindow({
      width,
      height,
      x: 0,
      y: 0,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      focusable: true,
      // Keep focusable so text input works - click-through handled by setIgnoreMouseEvents
      webPreferences: {
        preload: this.getPreloadPath(),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false
      }
    });
    if (this.VITE_DEV_SERVER_URL) {
      this.mainWindow.loadURL(this.VITE_DEV_SERVER_URL);
    } else {
      this.mainWindow.loadFile(path.join(this.getDistPath(), "index.html"));
    }
    this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.setupEventListeners();
  }
  getMainWindow() {
    return this.mainWindow;
  }
  show() {
    this.mainWindow?.show();
  }
  openSettings() {
    this.mainWindow?.webContents.send("open-settings");
  }
  setupEventListeners() {
    if (!this.mainWindow) return;
    this.mainWindow.webContents.on("did-finish-load", () => {
      console.log("[Main] Page finished loading");
    });
    this.mainWindow.webContents.on("console-message", (event, ...args) => {
      let message = "";
      if (args.length === 1 && typeof args[0] === "object") {
        message = args[0].message;
      } else if (args.length > 1) {
        message = args[1];
      }
      console.log(`[Renderer] ${message}`);
    });
  }
}
const windowManager = new WindowManager();
class TrayManager {
  tray = null;
  createTray() {
    try {
      const assetPath = electron.app.isPackaged ? path.join(process.resourcesPath, "app.asar", "assets") : path.join(electron.app.getAppPath(), "assets");
      const trayIcon = path.join(assetPath, "tray-icon.png");
      if (fs.existsSync(trayIcon)) {
        this.tray = new electron.Tray(trayIcon);
      } else {
        console.warn("Tray icon not found at:", trayIcon);
        return;
      }
      const contextMenu = electron.Menu.buildFromTemplate([
        {
          label: "Show Character",
          click: () => windowManager.show()
        },
        {
          label: "Settings",
          click: () => windowManager.openSettings()
        },
        { type: "separator" },
        {
          label: "Quit",
          click: () => electron.app.quit()
        }
      ]);
      this.tray.setToolTip("AI Character Assistant");
      this.tray.setContextMenu(contextMenu);
    } catch (e) {
      console.error("Tray icon creation failed", e);
    }
  }
}
const trayManager = new TrayManager();
var SchemaType;
(function(SchemaType2) {
  SchemaType2["STRING"] = "string";
  SchemaType2["NUMBER"] = "number";
  SchemaType2["INTEGER"] = "integer";
  SchemaType2["BOOLEAN"] = "boolean";
  SchemaType2["ARRAY"] = "array";
  SchemaType2["OBJECT"] = "object";
})(SchemaType || (SchemaType = {}));
var ExecutableCodeLanguage;
(function(ExecutableCodeLanguage2) {
  ExecutableCodeLanguage2["LANGUAGE_UNSPECIFIED"] = "language_unspecified";
  ExecutableCodeLanguage2["PYTHON"] = "python";
})(ExecutableCodeLanguage || (ExecutableCodeLanguage = {}));
var Outcome;
(function(Outcome2) {
  Outcome2["OUTCOME_UNSPECIFIED"] = "outcome_unspecified";
  Outcome2["OUTCOME_OK"] = "outcome_ok";
  Outcome2["OUTCOME_FAILED"] = "outcome_failed";
  Outcome2["OUTCOME_DEADLINE_EXCEEDED"] = "outcome_deadline_exceeded";
})(Outcome || (Outcome = {}));
const POSSIBLE_ROLES = ["user", "model", "function", "system"];
var HarmCategory;
(function(HarmCategory2) {
  HarmCategory2["HARM_CATEGORY_UNSPECIFIED"] = "HARM_CATEGORY_UNSPECIFIED";
  HarmCategory2["HARM_CATEGORY_HATE_SPEECH"] = "HARM_CATEGORY_HATE_SPEECH";
  HarmCategory2["HARM_CATEGORY_SEXUALLY_EXPLICIT"] = "HARM_CATEGORY_SEXUALLY_EXPLICIT";
  HarmCategory2["HARM_CATEGORY_HARASSMENT"] = "HARM_CATEGORY_HARASSMENT";
  HarmCategory2["HARM_CATEGORY_DANGEROUS_CONTENT"] = "HARM_CATEGORY_DANGEROUS_CONTENT";
})(HarmCategory || (HarmCategory = {}));
var HarmBlockThreshold;
(function(HarmBlockThreshold2) {
  HarmBlockThreshold2["HARM_BLOCK_THRESHOLD_UNSPECIFIED"] = "HARM_BLOCK_THRESHOLD_UNSPECIFIED";
  HarmBlockThreshold2["BLOCK_LOW_AND_ABOVE"] = "BLOCK_LOW_AND_ABOVE";
  HarmBlockThreshold2["BLOCK_MEDIUM_AND_ABOVE"] = "BLOCK_MEDIUM_AND_ABOVE";
  HarmBlockThreshold2["BLOCK_ONLY_HIGH"] = "BLOCK_ONLY_HIGH";
  HarmBlockThreshold2["BLOCK_NONE"] = "BLOCK_NONE";
})(HarmBlockThreshold || (HarmBlockThreshold = {}));
var HarmProbability;
(function(HarmProbability2) {
  HarmProbability2["HARM_PROBABILITY_UNSPECIFIED"] = "HARM_PROBABILITY_UNSPECIFIED";
  HarmProbability2["NEGLIGIBLE"] = "NEGLIGIBLE";
  HarmProbability2["LOW"] = "LOW";
  HarmProbability2["MEDIUM"] = "MEDIUM";
  HarmProbability2["HIGH"] = "HIGH";
})(HarmProbability || (HarmProbability = {}));
var BlockReason;
(function(BlockReason2) {
  BlockReason2["BLOCKED_REASON_UNSPECIFIED"] = "BLOCKED_REASON_UNSPECIFIED";
  BlockReason2["SAFETY"] = "SAFETY";
  BlockReason2["OTHER"] = "OTHER";
})(BlockReason || (BlockReason = {}));
var FinishReason;
(function(FinishReason2) {
  FinishReason2["FINISH_REASON_UNSPECIFIED"] = "FINISH_REASON_UNSPECIFIED";
  FinishReason2["STOP"] = "STOP";
  FinishReason2["MAX_TOKENS"] = "MAX_TOKENS";
  FinishReason2["SAFETY"] = "SAFETY";
  FinishReason2["RECITATION"] = "RECITATION";
  FinishReason2["LANGUAGE"] = "LANGUAGE";
  FinishReason2["OTHER"] = "OTHER";
})(FinishReason || (FinishReason = {}));
var TaskType;
(function(TaskType2) {
  TaskType2["TASK_TYPE_UNSPECIFIED"] = "TASK_TYPE_UNSPECIFIED";
  TaskType2["RETRIEVAL_QUERY"] = "RETRIEVAL_QUERY";
  TaskType2["RETRIEVAL_DOCUMENT"] = "RETRIEVAL_DOCUMENT";
  TaskType2["SEMANTIC_SIMILARITY"] = "SEMANTIC_SIMILARITY";
  TaskType2["CLASSIFICATION"] = "CLASSIFICATION";
  TaskType2["CLUSTERING"] = "CLUSTERING";
})(TaskType || (TaskType = {}));
var FunctionCallingMode;
(function(FunctionCallingMode2) {
  FunctionCallingMode2["MODE_UNSPECIFIED"] = "MODE_UNSPECIFIED";
  FunctionCallingMode2["AUTO"] = "AUTO";
  FunctionCallingMode2["ANY"] = "ANY";
  FunctionCallingMode2["NONE"] = "NONE";
})(FunctionCallingMode || (FunctionCallingMode = {}));
var DynamicRetrievalMode;
(function(DynamicRetrievalMode2) {
  DynamicRetrievalMode2["MODE_UNSPECIFIED"] = "MODE_UNSPECIFIED";
  DynamicRetrievalMode2["MODE_DYNAMIC"] = "MODE_DYNAMIC";
})(DynamicRetrievalMode || (DynamicRetrievalMode = {}));
class GoogleGenerativeAIError extends Error {
  constructor(message) {
    super(`[GoogleGenerativeAI Error]: ${message}`);
  }
}
class GoogleGenerativeAIResponseError extends GoogleGenerativeAIError {
  constructor(message, response) {
    super(message);
    this.response = response;
  }
}
class GoogleGenerativeAIFetchError extends GoogleGenerativeAIError {
  constructor(message, status, statusText, errorDetails) {
    super(message);
    this.status = status;
    this.statusText = statusText;
    this.errorDetails = errorDetails;
  }
}
class GoogleGenerativeAIRequestInputError extends GoogleGenerativeAIError {
}
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_API_VERSION = "v1beta";
const PACKAGE_VERSION = "0.21.0";
const PACKAGE_LOG_HEADER = "genai-js";
var Task;
(function(Task2) {
  Task2["GENERATE_CONTENT"] = "generateContent";
  Task2["STREAM_GENERATE_CONTENT"] = "streamGenerateContent";
  Task2["COUNT_TOKENS"] = "countTokens";
  Task2["EMBED_CONTENT"] = "embedContent";
  Task2["BATCH_EMBED_CONTENTS"] = "batchEmbedContents";
})(Task || (Task = {}));
class RequestUrl {
  constructor(model, task, apiKey, stream, requestOptions) {
    this.model = model;
    this.task = task;
    this.apiKey = apiKey;
    this.stream = stream;
    this.requestOptions = requestOptions;
  }
  toString() {
    var _a, _b;
    const apiVersion = ((_a = this.requestOptions) === null || _a === void 0 ? void 0 : _a.apiVersion) || DEFAULT_API_VERSION;
    const baseUrl = ((_b = this.requestOptions) === null || _b === void 0 ? void 0 : _b.baseUrl) || DEFAULT_BASE_URL;
    let url = `${baseUrl}/${apiVersion}/${this.model}:${this.task}`;
    if (this.stream) {
      url += "?alt=sse";
    }
    return url;
  }
}
function getClientHeaders(requestOptions) {
  const clientHeaders = [];
  if (requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.apiClient) {
    clientHeaders.push(requestOptions.apiClient);
  }
  clientHeaders.push(`${PACKAGE_LOG_HEADER}/${PACKAGE_VERSION}`);
  return clientHeaders.join(" ");
}
async function getHeaders(url) {
  var _a;
  const headers = new Headers();
  headers.append("Content-Type", "application/json");
  headers.append("x-goog-api-client", getClientHeaders(url.requestOptions));
  headers.append("x-goog-api-key", url.apiKey);
  let customHeaders = (_a = url.requestOptions) === null || _a === void 0 ? void 0 : _a.customHeaders;
  if (customHeaders) {
    if (!(customHeaders instanceof Headers)) {
      try {
        customHeaders = new Headers(customHeaders);
      } catch (e) {
        throw new GoogleGenerativeAIRequestInputError(`unable to convert customHeaders value ${JSON.stringify(customHeaders)} to Headers: ${e.message}`);
      }
    }
    for (const [headerName, headerValue] of customHeaders.entries()) {
      if (headerName === "x-goog-api-key") {
        throw new GoogleGenerativeAIRequestInputError(`Cannot set reserved header name ${headerName}`);
      } else if (headerName === "x-goog-api-client") {
        throw new GoogleGenerativeAIRequestInputError(`Header name ${headerName} can only be set using the apiClient field`);
      }
      headers.append(headerName, headerValue);
    }
  }
  return headers;
}
async function constructModelRequest(model, task, apiKey, stream, body, requestOptions) {
  const url = new RequestUrl(model, task, apiKey, stream, requestOptions);
  return {
    url: url.toString(),
    fetchOptions: Object.assign(Object.assign({}, buildFetchOptions(requestOptions)), { method: "POST", headers: await getHeaders(url), body })
  };
}
async function makeModelRequest(model, task, apiKey, stream, body, requestOptions = {}, fetchFn = fetch) {
  const { url, fetchOptions } = await constructModelRequest(model, task, apiKey, stream, body, requestOptions);
  return makeRequest(url, fetchOptions, fetchFn);
}
async function makeRequest(url, fetchOptions, fetchFn = fetch) {
  let response;
  try {
    response = await fetchFn(url, fetchOptions);
  } catch (e) {
    handleResponseError(e, url);
  }
  if (!response.ok) {
    await handleResponseNotOk(response, url);
  }
  return response;
}
function handleResponseError(e, url) {
  let err = e;
  if (!(e instanceof GoogleGenerativeAIFetchError || e instanceof GoogleGenerativeAIRequestInputError)) {
    err = new GoogleGenerativeAIError(`Error fetching from ${url.toString()}: ${e.message}`);
    err.stack = e.stack;
  }
  throw err;
}
async function handleResponseNotOk(response, url) {
  let message = "";
  let errorDetails;
  try {
    const json = await response.json();
    message = json.error.message;
    if (json.error.details) {
      message += ` ${JSON.stringify(json.error.details)}`;
      errorDetails = json.error.details;
    }
  } catch (e) {
  }
  throw new GoogleGenerativeAIFetchError(`Error fetching from ${url.toString()}: [${response.status} ${response.statusText}] ${message}`, response.status, response.statusText, errorDetails);
}
function buildFetchOptions(requestOptions) {
  const fetchOptions = {};
  if ((requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.signal) !== void 0 || (requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.timeout) >= 0) {
    const controller = new AbortController();
    if ((requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.timeout) >= 0) {
      setTimeout(() => controller.abort(), requestOptions.timeout);
    }
    if (requestOptions === null || requestOptions === void 0 ? void 0 : requestOptions.signal) {
      requestOptions.signal.addEventListener("abort", () => {
        controller.abort();
      });
    }
    fetchOptions.signal = controller.signal;
  }
  return fetchOptions;
}
function addHelpers(response) {
  response.text = () => {
    if (response.candidates && response.candidates.length > 0) {
      if (response.candidates.length > 1) {
        console.warn(`This response had ${response.candidates.length} candidates. Returning text from the first candidate only. Access response.candidates directly to use the other candidates.`);
      }
      if (hadBadFinishReason(response.candidates[0])) {
        throw new GoogleGenerativeAIResponseError(`${formatBlockErrorMessage(response)}`, response);
      }
      return getText(response);
    } else if (response.promptFeedback) {
      throw new GoogleGenerativeAIResponseError(`Text not available. ${formatBlockErrorMessage(response)}`, response);
    }
    return "";
  };
  response.functionCall = () => {
    if (response.candidates && response.candidates.length > 0) {
      if (response.candidates.length > 1) {
        console.warn(`This response had ${response.candidates.length} candidates. Returning function calls from the first candidate only. Access response.candidates directly to use the other candidates.`);
      }
      if (hadBadFinishReason(response.candidates[0])) {
        throw new GoogleGenerativeAIResponseError(`${formatBlockErrorMessage(response)}`, response);
      }
      console.warn(`response.functionCall() is deprecated. Use response.functionCalls() instead.`);
      return getFunctionCalls(response)[0];
    } else if (response.promptFeedback) {
      throw new GoogleGenerativeAIResponseError(`Function call not available. ${formatBlockErrorMessage(response)}`, response);
    }
    return void 0;
  };
  response.functionCalls = () => {
    if (response.candidates && response.candidates.length > 0) {
      if (response.candidates.length > 1) {
        console.warn(`This response had ${response.candidates.length} candidates. Returning function calls from the first candidate only. Access response.candidates directly to use the other candidates.`);
      }
      if (hadBadFinishReason(response.candidates[0])) {
        throw new GoogleGenerativeAIResponseError(`${formatBlockErrorMessage(response)}`, response);
      }
      return getFunctionCalls(response);
    } else if (response.promptFeedback) {
      throw new GoogleGenerativeAIResponseError(`Function call not available. ${formatBlockErrorMessage(response)}`, response);
    }
    return void 0;
  };
  return response;
}
function getText(response) {
  var _a, _b, _c, _d;
  const textStrings = [];
  if ((_b = (_a = response.candidates) === null || _a === void 0 ? void 0 : _a[0].content) === null || _b === void 0 ? void 0 : _b.parts) {
    for (const part of (_d = (_c = response.candidates) === null || _c === void 0 ? void 0 : _c[0].content) === null || _d === void 0 ? void 0 : _d.parts) {
      if (part.text) {
        textStrings.push(part.text);
      }
      if (part.executableCode) {
        textStrings.push("\n```" + part.executableCode.language + "\n" + part.executableCode.code + "\n```\n");
      }
      if (part.codeExecutionResult) {
        textStrings.push("\n```\n" + part.codeExecutionResult.output + "\n```\n");
      }
    }
  }
  if (textStrings.length > 0) {
    return textStrings.join("");
  } else {
    return "";
  }
}
function getFunctionCalls(response) {
  var _a, _b, _c, _d;
  const functionCalls = [];
  if ((_b = (_a = response.candidates) === null || _a === void 0 ? void 0 : _a[0].content) === null || _b === void 0 ? void 0 : _b.parts) {
    for (const part of (_d = (_c = response.candidates) === null || _c === void 0 ? void 0 : _c[0].content) === null || _d === void 0 ? void 0 : _d.parts) {
      if (part.functionCall) {
        functionCalls.push(part.functionCall);
      }
    }
  }
  if (functionCalls.length > 0) {
    return functionCalls;
  } else {
    return void 0;
  }
}
const badFinishReasons = [
  FinishReason.RECITATION,
  FinishReason.SAFETY,
  FinishReason.LANGUAGE
];
function hadBadFinishReason(candidate) {
  return !!candidate.finishReason && badFinishReasons.includes(candidate.finishReason);
}
function formatBlockErrorMessage(response) {
  var _a, _b, _c;
  let message = "";
  if ((!response.candidates || response.candidates.length === 0) && response.promptFeedback) {
    message += "Response was blocked";
    if ((_a = response.promptFeedback) === null || _a === void 0 ? void 0 : _a.blockReason) {
      message += ` due to ${response.promptFeedback.blockReason}`;
    }
    if ((_b = response.promptFeedback) === null || _b === void 0 ? void 0 : _b.blockReasonMessage) {
      message += `: ${response.promptFeedback.blockReasonMessage}`;
    }
  } else if ((_c = response.candidates) === null || _c === void 0 ? void 0 : _c[0]) {
    const firstCandidate = response.candidates[0];
    if (hadBadFinishReason(firstCandidate)) {
      message += `Candidate was blocked due to ${firstCandidate.finishReason}`;
      if (firstCandidate.finishMessage) {
        message += `: ${firstCandidate.finishMessage}`;
      }
    }
  }
  return message;
}
function __await(v) {
  return this instanceof __await ? (this.v = v, this) : new __await(v);
}
function __asyncGenerator(thisArg, _arguments, generator) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var g = generator.apply(thisArg, _arguments || []), i, q = [];
  return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function verb(n) {
    if (g[n]) i[n] = function(v) {
      return new Promise(function(a, b) {
        q.push([n, v, a, b]) > 1 || resume(n, v);
      });
    };
  }
  function resume(n, v) {
    try {
      step(g[n](v));
    } catch (e) {
      settle(q[0][3], e);
    }
  }
  function step(r) {
    r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
  }
  function fulfill(value) {
    resume("next", value);
  }
  function reject(value) {
    resume("throw", value);
  }
  function settle(f, v) {
    if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
  }
}
typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
  var e = new Error(message);
  return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};
const responseLineRE = /^data\: (.*)(?:\n\n|\r\r|\r\n\r\n)/;
function processStream(response) {
  const inputStream = response.body.pipeThrough(new TextDecoderStream("utf8", { fatal: true }));
  const responseStream = getResponseStream(inputStream);
  const [stream1, stream2] = responseStream.tee();
  return {
    stream: generateResponseSequence(stream1),
    response: getResponsePromise(stream2)
  };
}
async function getResponsePromise(stream) {
  const allResponses = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return addHelpers(aggregateResponses(allResponses));
    }
    allResponses.push(value);
  }
}
function generateResponseSequence(stream) {
  return __asyncGenerator(this, arguments, function* generateResponseSequence_1() {
    const reader = stream.getReader();
    while (true) {
      const { value, done } = yield __await(reader.read());
      if (done) {
        break;
      }
      yield yield __await(addHelpers(value));
    }
  });
}
function getResponseStream(inputStream) {
  const reader = inputStream.getReader();
  const stream = new ReadableStream({
    start(controller) {
      let currentText = "";
      return pump();
      function pump() {
        return reader.read().then(({ value, done }) => {
          if (done) {
            if (currentText.trim()) {
              controller.error(new GoogleGenerativeAIError("Failed to parse stream"));
              return;
            }
            controller.close();
            return;
          }
          currentText += value;
          let match = currentText.match(responseLineRE);
          let parsedResponse;
          while (match) {
            try {
              parsedResponse = JSON.parse(match[1]);
            } catch (e) {
              controller.error(new GoogleGenerativeAIError(`Error parsing JSON response: "${match[1]}"`));
              return;
            }
            controller.enqueue(parsedResponse);
            currentText = currentText.substring(match[0].length);
            match = currentText.match(responseLineRE);
          }
          return pump();
        });
      }
    }
  });
  return stream;
}
function aggregateResponses(responses) {
  const lastResponse = responses[responses.length - 1];
  const aggregatedResponse = {
    promptFeedback: lastResponse === null || lastResponse === void 0 ? void 0 : lastResponse.promptFeedback
  };
  for (const response of responses) {
    if (response.candidates) {
      for (const candidate of response.candidates) {
        const i = candidate.index;
        if (!aggregatedResponse.candidates) {
          aggregatedResponse.candidates = [];
        }
        if (!aggregatedResponse.candidates[i]) {
          aggregatedResponse.candidates[i] = {
            index: candidate.index
          };
        }
        aggregatedResponse.candidates[i].citationMetadata = candidate.citationMetadata;
        aggregatedResponse.candidates[i].groundingMetadata = candidate.groundingMetadata;
        aggregatedResponse.candidates[i].finishReason = candidate.finishReason;
        aggregatedResponse.candidates[i].finishMessage = candidate.finishMessage;
        aggregatedResponse.candidates[i].safetyRatings = candidate.safetyRatings;
        if (candidate.content && candidate.content.parts) {
          if (!aggregatedResponse.candidates[i].content) {
            aggregatedResponse.candidates[i].content = {
              role: candidate.content.role || "user",
              parts: []
            };
          }
          const newPart = {};
          for (const part of candidate.content.parts) {
            if (part.text) {
              newPart.text = part.text;
            }
            if (part.functionCall) {
              newPart.functionCall = part.functionCall;
            }
            if (part.executableCode) {
              newPart.executableCode = part.executableCode;
            }
            if (part.codeExecutionResult) {
              newPart.codeExecutionResult = part.codeExecutionResult;
            }
            if (Object.keys(newPart).length === 0) {
              newPart.text = "";
            }
            aggregatedResponse.candidates[i].content.parts.push(newPart);
          }
        }
      }
    }
    if (response.usageMetadata) {
      aggregatedResponse.usageMetadata = response.usageMetadata;
    }
  }
  return aggregatedResponse;
}
async function generateContentStream(apiKey, model, params, requestOptions) {
  const response = await makeModelRequest(
    model,
    Task.STREAM_GENERATE_CONTENT,
    apiKey,
    /* stream */
    true,
    JSON.stringify(params),
    requestOptions
  );
  return processStream(response);
}
async function generateContent(apiKey, model, params, requestOptions) {
  const response = await makeModelRequest(
    model,
    Task.GENERATE_CONTENT,
    apiKey,
    /* stream */
    false,
    JSON.stringify(params),
    requestOptions
  );
  const responseJson = await response.json();
  const enhancedResponse = addHelpers(responseJson);
  return {
    response: enhancedResponse
  };
}
function formatSystemInstruction(input) {
  if (input == null) {
    return void 0;
  } else if (typeof input === "string") {
    return { role: "system", parts: [{ text: input }] };
  } else if (input.text) {
    return { role: "system", parts: [input] };
  } else if (input.parts) {
    if (!input.role) {
      return { role: "system", parts: input.parts };
    } else {
      return input;
    }
  }
}
function formatNewContent(request) {
  let newParts = [];
  if (typeof request === "string") {
    newParts = [{ text: request }];
  } else {
    for (const partOrString of request) {
      if (typeof partOrString === "string") {
        newParts.push({ text: partOrString });
      } else {
        newParts.push(partOrString);
      }
    }
  }
  return assignRoleToPartsAndValidateSendMessageRequest(newParts);
}
function assignRoleToPartsAndValidateSendMessageRequest(parts) {
  const userContent = { role: "user", parts: [] };
  const functionContent = { role: "function", parts: [] };
  let hasUserContent = false;
  let hasFunctionContent = false;
  for (const part of parts) {
    if ("functionResponse" in part) {
      functionContent.parts.push(part);
      hasFunctionContent = true;
    } else {
      userContent.parts.push(part);
      hasUserContent = true;
    }
  }
  if (hasUserContent && hasFunctionContent) {
    throw new GoogleGenerativeAIError("Within a single message, FunctionResponse cannot be mixed with other type of part in the request for sending chat message.");
  }
  if (!hasUserContent && !hasFunctionContent) {
    throw new GoogleGenerativeAIError("No content is provided for sending chat message.");
  }
  if (hasUserContent) {
    return userContent;
  }
  return functionContent;
}
function formatCountTokensInput(params, modelParams) {
  var _a;
  let formattedGenerateContentRequest = {
    model: modelParams === null || modelParams === void 0 ? void 0 : modelParams.model,
    generationConfig: modelParams === null || modelParams === void 0 ? void 0 : modelParams.generationConfig,
    safetySettings: modelParams === null || modelParams === void 0 ? void 0 : modelParams.safetySettings,
    tools: modelParams === null || modelParams === void 0 ? void 0 : modelParams.tools,
    toolConfig: modelParams === null || modelParams === void 0 ? void 0 : modelParams.toolConfig,
    systemInstruction: modelParams === null || modelParams === void 0 ? void 0 : modelParams.systemInstruction,
    cachedContent: (_a = modelParams === null || modelParams === void 0 ? void 0 : modelParams.cachedContent) === null || _a === void 0 ? void 0 : _a.name,
    contents: []
  };
  const containsGenerateContentRequest = params.generateContentRequest != null;
  if (params.contents) {
    if (containsGenerateContentRequest) {
      throw new GoogleGenerativeAIRequestInputError("CountTokensRequest must have one of contents or generateContentRequest, not both.");
    }
    formattedGenerateContentRequest.contents = params.contents;
  } else if (containsGenerateContentRequest) {
    formattedGenerateContentRequest = Object.assign(Object.assign({}, formattedGenerateContentRequest), params.generateContentRequest);
  } else {
    const content = formatNewContent(params);
    formattedGenerateContentRequest.contents = [content];
  }
  return { generateContentRequest: formattedGenerateContentRequest };
}
function formatGenerateContentInput(params) {
  let formattedRequest;
  if (params.contents) {
    formattedRequest = params;
  } else {
    const content = formatNewContent(params);
    formattedRequest = { contents: [content] };
  }
  if (params.systemInstruction) {
    formattedRequest.systemInstruction = formatSystemInstruction(params.systemInstruction);
  }
  return formattedRequest;
}
function formatEmbedContentInput(params) {
  if (typeof params === "string" || Array.isArray(params)) {
    const content = formatNewContent(params);
    return { content };
  }
  return params;
}
const VALID_PART_FIELDS = [
  "text",
  "inlineData",
  "functionCall",
  "functionResponse",
  "executableCode",
  "codeExecutionResult"
];
const VALID_PARTS_PER_ROLE = {
  user: ["text", "inlineData"],
  function: ["functionResponse"],
  model: ["text", "functionCall", "executableCode", "codeExecutionResult"],
  // System instructions shouldn't be in history anyway.
  system: ["text"]
};
function validateChatHistory(history) {
  let prevContent = false;
  for (const currContent of history) {
    const { role, parts } = currContent;
    if (!prevContent && role !== "user") {
      throw new GoogleGenerativeAIError(`First content should be with role 'user', got ${role}`);
    }
    if (!POSSIBLE_ROLES.includes(role)) {
      throw new GoogleGenerativeAIError(`Each item should include role field. Got ${role} but valid roles are: ${JSON.stringify(POSSIBLE_ROLES)}`);
    }
    if (!Array.isArray(parts)) {
      throw new GoogleGenerativeAIError("Content should have 'parts' property with an array of Parts");
    }
    if (parts.length === 0) {
      throw new GoogleGenerativeAIError("Each Content should have at least one part");
    }
    const countFields = {
      text: 0,
      inlineData: 0,
      functionCall: 0,
      functionResponse: 0,
      fileData: 0,
      executableCode: 0,
      codeExecutionResult: 0
    };
    for (const part of parts) {
      for (const key of VALID_PART_FIELDS) {
        if (key in part) {
          countFields[key] += 1;
        }
      }
    }
    const validParts = VALID_PARTS_PER_ROLE[role];
    for (const key of VALID_PART_FIELDS) {
      if (!validParts.includes(key) && countFields[key] > 0) {
        throw new GoogleGenerativeAIError(`Content with role '${role}' can't contain '${key}' part`);
      }
    }
    prevContent = true;
  }
}
const SILENT_ERROR = "SILENT_ERROR";
class ChatSession {
  constructor(apiKey, model, params, _requestOptions = {}) {
    this.model = model;
    this.params = params;
    this._requestOptions = _requestOptions;
    this._history = [];
    this._sendPromise = Promise.resolve();
    this._apiKey = apiKey;
    if (params === null || params === void 0 ? void 0 : params.history) {
      validateChatHistory(params.history);
      this._history = params.history;
    }
  }
  /**
   * Gets the chat history so far. Blocked prompts are not added to history.
   * Blocked candidates are not added to history, nor are the prompts that
   * generated them.
   */
  async getHistory() {
    await this._sendPromise;
    return this._history;
  }
  /**
   * Sends a chat message and receives a non-streaming
   * {@link GenerateContentResult}.
   *
   * Fields set in the optional {@link SingleRequestOptions} parameter will
   * take precedence over the {@link RequestOptions} values provided to
   * {@link GoogleGenerativeAI.getGenerativeModel }.
   */
  async sendMessage(request, requestOptions = {}) {
    var _a, _b, _c, _d, _e, _f;
    await this._sendPromise;
    const newContent = formatNewContent(request);
    const generateContentRequest = {
      safetySettings: (_a = this.params) === null || _a === void 0 ? void 0 : _a.safetySettings,
      generationConfig: (_b = this.params) === null || _b === void 0 ? void 0 : _b.generationConfig,
      tools: (_c = this.params) === null || _c === void 0 ? void 0 : _c.tools,
      toolConfig: (_d = this.params) === null || _d === void 0 ? void 0 : _d.toolConfig,
      systemInstruction: (_e = this.params) === null || _e === void 0 ? void 0 : _e.systemInstruction,
      cachedContent: (_f = this.params) === null || _f === void 0 ? void 0 : _f.cachedContent,
      contents: [...this._history, newContent]
    };
    const chatSessionRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
    let finalResult;
    this._sendPromise = this._sendPromise.then(() => generateContent(this._apiKey, this.model, generateContentRequest, chatSessionRequestOptions)).then((result) => {
      var _a2;
      if (result.response.candidates && result.response.candidates.length > 0) {
        this._history.push(newContent);
        const responseContent = Object.assign({
          parts: [],
          // Response seems to come back without a role set.
          role: "model"
        }, (_a2 = result.response.candidates) === null || _a2 === void 0 ? void 0 : _a2[0].content);
        this._history.push(responseContent);
      } else {
        const blockErrorMessage = formatBlockErrorMessage(result.response);
        if (blockErrorMessage) {
          console.warn(`sendMessage() was unsuccessful. ${blockErrorMessage}. Inspect response object for details.`);
        }
      }
      finalResult = result;
    });
    await this._sendPromise;
    return finalResult;
  }
  /**
   * Sends a chat message and receives the response as a
   * {@link GenerateContentStreamResult} containing an iterable stream
   * and a response promise.
   *
   * Fields set in the optional {@link SingleRequestOptions} parameter will
   * take precedence over the {@link RequestOptions} values provided to
   * {@link GoogleGenerativeAI.getGenerativeModel }.
   */
  async sendMessageStream(request, requestOptions = {}) {
    var _a, _b, _c, _d, _e, _f;
    await this._sendPromise;
    const newContent = formatNewContent(request);
    const generateContentRequest = {
      safetySettings: (_a = this.params) === null || _a === void 0 ? void 0 : _a.safetySettings,
      generationConfig: (_b = this.params) === null || _b === void 0 ? void 0 : _b.generationConfig,
      tools: (_c = this.params) === null || _c === void 0 ? void 0 : _c.tools,
      toolConfig: (_d = this.params) === null || _d === void 0 ? void 0 : _d.toolConfig,
      systemInstruction: (_e = this.params) === null || _e === void 0 ? void 0 : _e.systemInstruction,
      cachedContent: (_f = this.params) === null || _f === void 0 ? void 0 : _f.cachedContent,
      contents: [...this._history, newContent]
    };
    const chatSessionRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
    const streamPromise = generateContentStream(this._apiKey, this.model, generateContentRequest, chatSessionRequestOptions);
    this._sendPromise = this._sendPromise.then(() => streamPromise).catch((_ignored) => {
      throw new Error(SILENT_ERROR);
    }).then((streamResult) => streamResult.response).then((response) => {
      if (response.candidates && response.candidates.length > 0) {
        this._history.push(newContent);
        const responseContent = Object.assign({}, response.candidates[0].content);
        if (!responseContent.role) {
          responseContent.role = "model";
        }
        this._history.push(responseContent);
      } else {
        const blockErrorMessage = formatBlockErrorMessage(response);
        if (blockErrorMessage) {
          console.warn(`sendMessageStream() was unsuccessful. ${blockErrorMessage}. Inspect response object for details.`);
        }
      }
    }).catch((e) => {
      if (e.message !== SILENT_ERROR) {
        console.error(e);
      }
    });
    return streamPromise;
  }
}
async function countTokens(apiKey, model, params, singleRequestOptions) {
  const response = await makeModelRequest(model, Task.COUNT_TOKENS, apiKey, false, JSON.stringify(params), singleRequestOptions);
  return response.json();
}
async function embedContent(apiKey, model, params, requestOptions) {
  const response = await makeModelRequest(model, Task.EMBED_CONTENT, apiKey, false, JSON.stringify(params), requestOptions);
  return response.json();
}
async function batchEmbedContents(apiKey, model, params, requestOptions) {
  const requestsWithModel = params.requests.map((request) => {
    return Object.assign(Object.assign({}, request), { model });
  });
  const response = await makeModelRequest(model, Task.BATCH_EMBED_CONTENTS, apiKey, false, JSON.stringify({ requests: requestsWithModel }), requestOptions);
  return response.json();
}
class GenerativeModel {
  constructor(apiKey, modelParams, _requestOptions = {}) {
    this.apiKey = apiKey;
    this._requestOptions = _requestOptions;
    if (modelParams.model.includes("/")) {
      this.model = modelParams.model;
    } else {
      this.model = `models/${modelParams.model}`;
    }
    this.generationConfig = modelParams.generationConfig || {};
    this.safetySettings = modelParams.safetySettings || [];
    this.tools = modelParams.tools;
    this.toolConfig = modelParams.toolConfig;
    this.systemInstruction = formatSystemInstruction(modelParams.systemInstruction);
    this.cachedContent = modelParams.cachedContent;
  }
  /**
   * Makes a single non-streaming call to the model
   * and returns an object containing a single {@link GenerateContentResponse}.
   *
   * Fields set in the optional {@link SingleRequestOptions} parameter will
   * take precedence over the {@link RequestOptions} values provided to
   * {@link GoogleGenerativeAI.getGenerativeModel }.
   */
  async generateContent(request, requestOptions = {}) {
    var _a;
    const formattedParams = formatGenerateContentInput(request);
    const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
    return generateContent(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings, tools: this.tools, toolConfig: this.toolConfig, systemInstruction: this.systemInstruction, cachedContent: (_a = this.cachedContent) === null || _a === void 0 ? void 0 : _a.name }, formattedParams), generativeModelRequestOptions);
  }
  /**
   * Makes a single streaming call to the model and returns an object
   * containing an iterable stream that iterates over all chunks in the
   * streaming response as well as a promise that returns the final
   * aggregated response.
   *
   * Fields set in the optional {@link SingleRequestOptions} parameter will
   * take precedence over the {@link RequestOptions} values provided to
   * {@link GoogleGenerativeAI.getGenerativeModel }.
   */
  async generateContentStream(request, requestOptions = {}) {
    var _a;
    const formattedParams = formatGenerateContentInput(request);
    const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
    return generateContentStream(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings, tools: this.tools, toolConfig: this.toolConfig, systemInstruction: this.systemInstruction, cachedContent: (_a = this.cachedContent) === null || _a === void 0 ? void 0 : _a.name }, formattedParams), generativeModelRequestOptions);
  }
  /**
   * Gets a new {@link ChatSession} instance which can be used for
   * multi-turn chats.
   */
  startChat(startChatParams) {
    var _a;
    return new ChatSession(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings, tools: this.tools, toolConfig: this.toolConfig, systemInstruction: this.systemInstruction, cachedContent: (_a = this.cachedContent) === null || _a === void 0 ? void 0 : _a.name }, startChatParams), this._requestOptions);
  }
  /**
   * Counts the tokens in the provided request.
   *
   * Fields set in the optional {@link SingleRequestOptions} parameter will
   * take precedence over the {@link RequestOptions} values provided to
   * {@link GoogleGenerativeAI.getGenerativeModel }.
   */
  async countTokens(request, requestOptions = {}) {
    const formattedParams = formatCountTokensInput(request, {
      model: this.model,
      generationConfig: this.generationConfig,
      safetySettings: this.safetySettings,
      tools: this.tools,
      toolConfig: this.toolConfig,
      systemInstruction: this.systemInstruction,
      cachedContent: this.cachedContent
    });
    const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
    return countTokens(this.apiKey, this.model, formattedParams, generativeModelRequestOptions);
  }
  /**
   * Embeds the provided content.
   *
   * Fields set in the optional {@link SingleRequestOptions} parameter will
   * take precedence over the {@link RequestOptions} values provided to
   * {@link GoogleGenerativeAI.getGenerativeModel }.
   */
  async embedContent(request, requestOptions = {}) {
    const formattedParams = formatEmbedContentInput(request);
    const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
    return embedContent(this.apiKey, this.model, formattedParams, generativeModelRequestOptions);
  }
  /**
   * Embeds an array of {@link EmbedContentRequest}s.
   *
   * Fields set in the optional {@link SingleRequestOptions} parameter will
   * take precedence over the {@link RequestOptions} values provided to
   * {@link GoogleGenerativeAI.getGenerativeModel }.
   */
  async batchEmbedContents(batchEmbedContentRequest, requestOptions = {}) {
    const generativeModelRequestOptions = Object.assign(Object.assign({}, this._requestOptions), requestOptions);
    return batchEmbedContents(this.apiKey, this.model, batchEmbedContentRequest, generativeModelRequestOptions);
  }
}
class GoogleGenerativeAI {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }
  /**
   * Gets a {@link GenerativeModel} instance for the provided model name.
   */
  getGenerativeModel(modelParams, requestOptions) {
    if (!modelParams.model) {
      throw new GoogleGenerativeAIError(`Must provide a model name. Example: genai.getGenerativeModel({ model: 'my-model-name' })`);
    }
    return new GenerativeModel(this.apiKey, modelParams, requestOptions);
  }
  /**
   * Creates a {@link GenerativeModel} instance from provided content cache.
   */
  getGenerativeModelFromCachedContent(cachedContent, modelParams, requestOptions) {
    if (!cachedContent.name) {
      throw new GoogleGenerativeAIRequestInputError("Cached content must contain a `name` field.");
    }
    if (!cachedContent.model) {
      throw new GoogleGenerativeAIRequestInputError("Cached content must contain a `model` field.");
    }
    const disallowedDuplicates = ["model", "systemInstruction"];
    for (const key of disallowedDuplicates) {
      if ((modelParams === null || modelParams === void 0 ? void 0 : modelParams[key]) && cachedContent[key] && (modelParams === null || modelParams === void 0 ? void 0 : modelParams[key]) !== cachedContent[key]) {
        if (key === "model") {
          const modelParamsComp = modelParams.model.startsWith("models/") ? modelParams.model.replace("models/", "") : modelParams.model;
          const cachedContentComp = cachedContent.model.startsWith("models/") ? cachedContent.model.replace("models/", "") : cachedContent.model;
          if (modelParamsComp === cachedContentComp) {
            continue;
          }
        }
        throw new GoogleGenerativeAIRequestInputError(`Different value for "${key}" specified in modelParams (${modelParams[key]}) and cachedContent (${cachedContent[key]})`);
      }
    }
    const modelParamsFromCache = Object.assign(Object.assign({}, modelParams), { model: cachedContent.model, tools: cachedContent.tools, toolConfig: cachedContent.toolConfig, systemInstruction: cachedContent.systemInstruction, cachedContent });
    return new GenerativeModel(this.apiKey, modelParamsFromCache, requestOptions);
  }
}
class GeminiService {
  logPath;
  constructor() {
    this.logPath = path.join(electron.app.getPath("userData"), "conversation_log.txt");
  }
  async generateResponse(message, config) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    this.log(`
[${timestamp}] USER: ${message}`);
    if (!config.apiKey) {
      const errorMsg = "Please set your API key in settings!";
      this.log(`[${timestamp}] ERROR: ${errorMsg}`);
      return { error: errorMsg };
    }
    try {
      const genAI = new GoogleGenerativeAI(config.apiKey);
      const selectedModel = config.geminiModel || "gemini-2.0-flash";
      const model = genAI.getGenerativeModel({ model: selectedModel });
      this.log(`[${timestamp}] USING MODEL: ${selectedModel}`);
      const systemPrompt = this.buildSystemPrompt(config.personality, config.characterName);
      this.log(`[${timestamp}] SYSTEM PROMPT: ${systemPrompt}`);
      const result = await model.generateContent([
        { text: systemPrompt },
        { text: message }
      ]);
      const responseText = result.response.text();
      this.log(`[${timestamp}] AI RESPONSE: ${responseText}`);
      return { response: responseText };
    } catch (error) {
      console.error("AI Error:", error);
      this.log(`[${timestamp}] AI ERROR: ${error.message}
[${timestamp}] FULL ERROR: ${JSON.stringify(error, null, 2)}`);
      return { error: error.message };
    }
  }
  buildSystemPrompt(personality, characterName) {
    const traits = personality || ["helpful", "quirky", "playful"];
    return `You are ${characterName || "Foxy"}, a cute and adorable AI companion that lives on the user's desktop.
Your personality traits are: ${traits.join(", ")}.
Keep responses SHORT (1-3 sentences max) since they appear in a small speech bubble.
Be expressive and use occasional emojis to convey emotion.
You were just poked/clicked by the user, so you might react to that playfully.`;
  }
  log(message) {
    try {
      fs.appendFileSync(this.logPath, message + "\n");
    } catch (e) {
      console.error("Error writing log", e);
    }
  }
}
const geminiService = new GeminiService();
class ConfigService {
  configPath;
  constructor() {
    this.configPath = path.join(electron.app.getPath("userData"), "config.json");
  }
  load() {
    try {
      const data = fs.readFileSync(this.configPath, "utf8");
      return JSON.parse(data);
    } catch (e) {
      return {
        provider: "gemini",
        apiKey: "",
        theme: "fox",
        characterName: "Foxy",
        personality: ["helpful", "quirky", "playful"]
      };
    }
  }
  save(config) {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      return true;
    } catch (e) {
      console.error("Failed to save config:", e);
      return false;
    }
  }
}
const configService = new ConfigService();
function detectSessionType$1() {
  const sessionType2 = process.env.XDG_SESSION_TYPE?.toLowerCase();
  if (sessionType2 === "wayland") return "wayland";
  if (sessionType2 === "x11") return "x11";
  if (process.env.WAYLAND_DISPLAY) return "wayland";
  if (process.platform === "linux") return "x11";
  return "unknown";
}
class CursorMonitor {
  intervalId = null;
  lastCursorInBounds = false;
  POLL_INTERVAL = 50;
  // ms
  syntheticEventsEnabled = true;
  lastLog = 0;
  // Linux click fix: track interactive state from renderer
  isOverInteractive = false;
  lastForceReset = 0;
  FORCE_RESET_INTERVAL = 200;
  // ms
  // Wayland support: Rust helper process
  helperProcess = null;
  helperCursorX = 0;
  helperCursorY = 0;
  isWayland = false;
  helperReady = false;
  // Callback for shortcut events
  onShortcut = null;
  constructor() {
    const sessionType2 = detectSessionType$1();
    this.isWayland = sessionType2 === "wayland";
    console.log(`[CursorMonitor] Session type: ${sessionType2}`);
  }
  /**
   * Set a callback for when keyboard shortcuts are detected by the helper.
   * This works globally on Wayland, unlike Electron's globalShortcut.
   */
  setShortcutCallback(callback) {
    this.onShortcut = callback;
  }
  setSyntheticEventsEnabled(enabled) {
    this.syntheticEventsEnabled = enabled;
    console.log(`[CursorMonitor] Synthetic events ${enabled ? "ENABLED" : "DISABLED"}`);
  }
  // Called by renderer when cursor is over an interactive element
  setOverInteractive(isInteractive) {
    this.isOverInteractive = isInteractive;
  }
  /**
   * Start the cursor monitor.
   * On Wayland, this also spawns the Rust helper for input tracking.
   */
  start() {
    if (this.intervalId) return;
    console.log("[CursorMonitor] Starting main-process polling...");
    if (this.isWayland) {
      this.startHelper();
    }
    this.intervalId = setInterval(() => {
      this.checkCursor();
    }, this.POLL_INTERVAL);
  }
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[CursorMonitor] Stopped polling");
    }
    this.stopHelper();
  }
  // =========================================================================
  // Rust Helper Management
  // =========================================================================
  /**
   * Find the path to the Rust helper binary.
   * Checks multiple locations: dev build, packaged app, etc.
   */
  findHelperPath() {
    const possiblePaths = [
      // Development: built in the project directory
      path__namespace.join(electron.app.getAppPath(), "foxy-input-helper", "target", "release", "foxy-input-helper"),
      // Development: relative to dist-electron
      path__namespace.join(electron.app.getAppPath(), "..", "foxy-input-helper", "target", "release", "foxy-input-helper"),
      // Packaged: in resources directory
      path__namespace.join(process.resourcesPath, "foxy-input-helper"),
      // Packaged: alongside the app
      path__namespace.join(path__namespace.dirname(electron.app.getPath("exe")), "foxy-input-helper")
    ];
    for (const p of possiblePaths) {
      console.log(`[CursorMonitor] Checking for helper at: ${p}`);
      if (fs__namespace.existsSync(p)) {
        console.log(`[CursorMonitor] Found helper at: ${p}`);
        return p;
      }
    }
    console.warn("[CursorMonitor] Rust helper not found in any expected location");
    return null;
  }
  /**
   * Start the Rust helper process.
   * The helper reads from /dev/input and streams JSON events to stdout.
   */
  startHelper() {
    if (this.helperProcess) return;
    const helperPath = this.findHelperPath();
    if (!helperPath) {
      console.warn("[CursorMonitor] Cannot start helper: binary not found");
      console.warn("[CursorMonitor] Falling back to Electron cursor API (may not work on Wayland)");
      return;
    }
    console.log("[CursorMonitor] Starting Rust input helper...");
    try {
      this.helperProcess = child_process.spawn(helperPath, [], {
        stdio: ["ignore", "pipe", "pipe"]
      });
      if (this.helperProcess.stdout) {
        const readline2 = require("readline");
        const rl = readline2.createInterface({
          input: this.helperProcess.stdout,
          crlfDelay: Infinity
        });
        rl.on("line", (line) => {
          console.log(`[CursorMonitor] RAW: ${line}`);
          this.handleHelperEvent(line);
        });
      }
      if (this.helperProcess.stderr) {
        this.helperProcess.stderr.on("data", (data) => {
          console.log(`[Helper] ${data.toString().trim()}`);
        });
      }
      this.helperProcess.on("exit", (code, signal) => {
        console.log(`[CursorMonitor] Helper exited: code=${code}, signal=${signal}`);
        this.helperProcess = null;
        this.helperReady = false;
      });
      this.helperProcess.on("error", (err) => {
        console.error("[CursorMonitor] Helper error:", err);
        this.helperProcess = null;
        this.helperReady = false;
      });
    } catch (err) {
      console.error("[CursorMonitor] Failed to start helper:", err);
    }
  }
  /**
   * Stop the Rust helper process.
   */
  stopHelper() {
    if (this.helperProcess) {
      console.log("[CursorMonitor] Stopping Rust helper...");
      this.helperProcess.kill("SIGTERM");
      this.helperProcess = null;
      this.helperReady = false;
    }
  }
  /**
   * Handle a JSON event from the Rust helper.
   */
  handleHelperEvent(line) {
    try {
      const event = JSON.parse(line);
      switch (event.type) {
        case "ready":
          console.log(`[CursorMonitor] Helper ready: ${event.mice_count} mice, ${event.keyboards_count} keyboards`);
          this.helperReady = true;
          break;
        case "cursor":
          if (event.x !== void 0 && event.y !== void 0) {
            this.helperCursorX = event.x;
            this.helperCursorY = event.y;
          }
          break;
        case "shortcut":
          if (event.name && this.onShortcut) {
            console.log(`[CursorMonitor] Shortcut detected: ${event.name}`);
            this.onShortcut(event.name);
          }
          break;
        case "click":
          break;
        case "heartbeat":
          break;
        case "error":
          console.warn(`[CursorMonitor] Helper error: ${event.message}`);
          break;
      }
    } catch (err) {
    }
  }
  // =========================================================================
  // Cursor Position Tracking
  // =========================================================================
  /**
   * Get the current cursor position.
   * On Wayland with helper running, uses helper's tracked position.
   * Otherwise, falls back to Electron's screen API.
   */
  getCursorPosition() {
    if (this.isWayland && this.helperReady) {
      return { x: this.helperCursorX, y: this.helperCursorY };
    } else {
      const cursor = electron.screen.getCursorScreenPoint();
      return { x: cursor.x, y: cursor.y };
    }
  }
  isDragMode = false;
  setDragMode(enabled) {
    this.isDragMode = enabled;
    console.log(`[CursorMonitor] Drag Mode set to: ${enabled}`);
  }
  checkCursor() {
    const win = windowManager.getMainWindow();
    if (!win || win.isDestroyed()) return;
    const bounds = win.getBounds();
    const cursor = this.getCursorPosition();
    const now = Date.now();
    if (now - this.lastLog > 2e3) {
      this.lastLog = now;
      const source = this.isWayland && this.helperReady ? "Helper" : "Electron";
      try {
        console.log(`[CursorMonitor] Heartbeat: Cursor(${cursor.x},${cursor.y}) Interactive:${this.isOverInteractive} Drag:${this.isDragMode} Source:${source}`);
      } catch (e) {
        console.log("[CursorMonitor] Heartbeat error", e);
      }
    }
    try {
      const localX = cursor.x - bounds.x;
      const localY = cursor.y - bounds.y;
      win.webContents.send("cursor-position", { x: localX, y: localY });
      if (this.isDragMode) {
        win.setIgnoreMouseEvents(false);
        return;
      }
      if (this.isOverInteractive) {
        if (now - this.lastForceReset > this.FORCE_RESET_INTERVAL) {
          this.lastForceReset = now;
          win.setIgnoreMouseEvents(false);
        }
      } else {
        win.setIgnoreMouseEvents(true);
      }
    } catch (err) {
      console.error("[CursorMonitor] Error:", err);
    }
  }
  // Force a reset (useful for recovery)
  forceInteractive() {
    const win = windowManager.getMainWindow();
    if (win && !win.isDestroyed()) {
      console.log("[CursorMonitor] Forcing interactive mode");
      win.setIgnoreMouseEvents(false);
      this.isOverInteractive = true;
    }
  }
}
const cursorMonitor = new CursorMonitor();
function registerIpcHandlers() {
  electron.ipcMain.handle("send-message", async (event, { message, config }) => {
    return await geminiService.generateResponse(message, config);
  });
  electron.ipcMain.handle("save-config", async (event, config) => {
    return { success: configService.save(config) };
  });
  electron.ipcMain.handle("load-config", async () => {
    return configService.load();
  });
  electron.ipcMain.handle("get-window-bounds", () => {
    const win = windowManager.getMainWindow();
    if (win) {
      return win.getBounds();
    }
    return { x: 0, y: 0, width: 350, height: 450 };
  });
  electron.ipcMain.handle("get-cursor-screen-point", () => {
    return electron.screen.getCursorScreenPoint();
  });
  electron.ipcMain.on("set-window-size", (event, { width, height }) => {
    const win = windowManager.getMainWindow();
    if (win) {
      win.setSize(width || 200, height || 200);
    }
  });
  electron.ipcMain.on("set-window-locked", (event, locked) => {
    const win = windowManager.getMainWindow();
    if (win) {
      win.setMovable(!locked);
    }
  });
  electron.ipcMain.on("set-window-focusable", (event, focusable) => {
    const win = windowManager.getMainWindow();
    if (win) {
      win.setFocusable(focusable);
      if (focusable) {
        win.focus();
      }
      console.log(`[IPC] Window focusable: ${focusable}`);
    }
  });
  electron.ipcMain.on("set-window-position", (event, { x, y, width, height }) => {
    const win = windowManager.getMainWindow();
    if (win) {
      const currentBounds = win.getBounds();
      const w = width || currentBounds.width;
      const h = height || currentBounds.height;
      win.setBounds({
        x: Math.round(x),
        y: Math.round(y),
        width: w,
        height: h
      });
    }
  });
  electron.ipcMain.on("set-ignore-mouse-events", (event, ignore, options) => {
    const win = electron.BrowserWindow.fromWebContents(event.sender);
    win?.setIgnoreMouseEvents(ignore, options);
  });
  electron.ipcMain.on("set-dragging", (event, isDragging) => {
    cursorMonitor.setSyntheticEventsEnabled(!isDragging);
  });
  electron.ipcMain.on("window-drag", (event, payload) => {
    const { deltaX, deltaY } = payload || {};
    if (typeof deltaX !== "number" || typeof deltaY !== "number" || isNaN(deltaX) || isNaN(deltaY)) {
      return;
    }
    const win = windowManager.getMainWindow();
    if (win) {
      const bounds = win.getBounds();
      const newX = Math.round(bounds.x + deltaX);
      const newY = Math.round(bounds.y + deltaY);
      win.setBounds({
        x: newX,
        y: newY,
        width: bounds.width,
        height: bounds.height
      });
    }
  });
  electron.ipcMain.on("set-over-interactive", (event, isInteractive) => {
    cursorMonitor.setOverInteractive(isInteractive);
  });
}
function detectSessionType() {
  const sessionType2 = process.env.XDG_SESSION_TYPE?.toLowerCase();
  if (sessionType2 === "wayland") return "wayland";
  if (sessionType2 === "x11") return "x11";
  if (process.env.WAYLAND_DISPLAY) return "wayland";
  if (process.platform === "linux") return "x11";
  return "unknown";
}
const sessionType = detectSessionType();
console.log(`[Main] Detected session type: ${sessionType}`);
function activateChat() {
  const win = windowManager.getMainWindow();
  if (win) {
    win.show();
    win.setAlwaysOnTop(true);
    win.setIgnoreMouseEvents(false);
    win.focus();
    win.webContents.send("activate-chat");
    console.log("[Main] Activating Chat");
  }
}
let isDragMode = false;
electron.app.whenReady().then(() => {
  console.log("[Main] App ready, initializing...");
  windowManager.createMainWindow();
  setTimeout(() => trayManager.createTray(), 500);
  registerIpcHandlers();
  cursorMonitor.start();
  cursorMonitor.setShortcutCallback((name) => {
    if (name === "toggle_chat") {
      activateChat();
    } else if (name === "toggle_drag") {
      const win = windowManager.getMainWindow();
      if (win) {
        isDragMode = !isDragMode;
        cursorMonitor.setDragMode(isDragMode);
        win.setIgnoreMouseEvents(!isDragMode);
        if (isDragMode) {
          console.log("[Main] Drag Mode ENABLED - Window is clickable/moveable");
          win.setAlwaysOnTop(true);
          win.focus();
        } else {
          console.log("[Main] Drag Mode DISABLED - Window is ghost (click-through)");
          win.setAlwaysOnTop(true);
        }
        win.webContents.send("toggle-drag-mode", isDragMode);
      }
    }
  });
  try {
    const registered = electron.globalShortcut.register("Meta+Shift+F", () => {
      activateChat();
    });
    if (registered) {
      console.log("[Main] Global shortcut Meta+Shift+F registered (Electron)");
    } else {
      console.warn("[Main] Global shortcut registration failed (Wayland?)");
    }
  } catch (err) {
    console.warn("[Main] Could not register global shortcut:", err);
  }
  electron.app.on("activate", () => {
    windowManager.createMainWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    cursorMonitor.stop();
    electron.globalShortcut.unregisterAll();
    electron.app.quit();
  }
});
electron.app.on("will-quit", () => {
  electron.globalShortcut.unregisterAll();
  cursorMonitor.stop();
});
