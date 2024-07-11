/**
 * © Copyright IBM Corp. 2016, 2020 All Rights Reserved
 *   Project name: JSONata
 *   This project is licensed under the MIT License, see LICENSE
 */

import React from 'react';
import SplitPane from 'react-split-pane';
import MonacoEditor from 'react-monaco-editor';
import ScreenshotComponent from './ScreenshotComponent'; // Updated import
import format from './images/format.png';
import docs from './images/docs-white-32.png';
import jsonataMode from './jsonataMode';
import { getLibraryHandle } from './externalLibsComponent';
import RecordList from './RecordList'; // Import RecordList component
import axios from 'axios';

const baseUri = 'https://us-south.functions.appdomain.cloud/api/v1/web/04d6b400-5947-46c6-ae3e-ebdf4a7056de/default/';

class Exerciser extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            json: '{}', // Start with an empty JSON
            jsonata: '',
            bindings: '',
            result: '',
            panelStates: {
                bindings: 'hidden'
            },
            externalLibs: [],
            webpImage: null
        };
    }

    setPanelState(panel, state) {
        this.setState({ panelStates: { ...this.state.panelStates, [panel]: state } });
    }

    /*
    async onSelectRecord(id) {
        try {
            const response = await axios.get(`https://jsonata.appleby-analytics.com/api/record/${id}`);
            this.setState({ json: JSON.stringify(response.data.accessibility) });
          
            this.onChangeData(JSON.stringify(response.data.accessibility));
            this.format();
        } catch (error) {
            console.error('Error fetching record:', error);
        }
    }
    */
    async onSelectRecord(recordData) {
        try {
            this.setState({ json: JSON.stringify(recordData.accessibility) });
            this.onChangeData(JSON.stringify(recordData.accessibility));
            this.format();
        } catch (error) {
            console.error('Error processing record:', error);
        }
    }

    componentDidMount() {
        this.loadJSONata();
        fetch(baseUri + 'jsonata-versions.json')
            .then(res => res.json())
            .then(
                result => {
                    console.log(result);
                    if (process.env.NODE_ENV === 'development') {
                        result.versions.unshift('local');
                    }
                    const select = document.getElementById('version-select');
                    result.versions.forEach(function (tag) {
                        const option = document.createElement("option");
                        option.text = tag;
                        option.value = tag;
                        select.add(option);
                    });
                    this.loadJSONata(result.versions[0]);
                },
                error => {
                    console.log(error);
                }
            );

        console.log(this.props.data);
        if (this.props.data) {
            this.setState({ json: 'Loading...', jsonata: 'Loading...' });
            const self = this;
            // load the data
            fetch(baseUri + 'get-shared.json?id=' + this.props.data)
                .then(res => res.json())
                .then(result => {
                    return Promise.all([Promise.resolve(result), this.getExternalLibsInitialized(result.externalLibs)])
                })
                .then(
                    async ([result, externalLibs]) => {
                        console.log(result);
                        this.setState({
                            json: (typeof result.json === 'undefined') ? '' : JSON.stringify(result.json, null, 2),
                            jsonata: result.jsonata,
                            bindings: result.bindings !== undefined ? result.bindings : '{\n  // name: value\n}',
                            externalLibs: externalLibs,
                            result: ''
                        });
                        await self.eval();
                    },
                    error => {
                        console.log(error);
                    }
                )
        } else {
            this.eval();
        }
    }

    getExternalLibsInitialized(externalLibs = []) {
        const allPromises = externalLibs.map(lib => {
            return fetch(lib.url)
                .then((res) => {
                    if (!res.ok) {
                        console.error(res);
                        return Promise.resolve(undefined);
                    }
                    return res.text();
                }).then(libFileText => {
                    if (!libFileText) {
                        console.error("Could not load library from " + lib.url);
                        return Promise.resolve(undefined);
                    }
                    const libraryContext = getLibraryHandle(libFileText, lib.moduleName);
                    return Promise.resolve({ ...lib, libraryContext: { [lib.moduleName]: libraryContext } });
                });
        });

        return Promise.all(allPromises);
    }

    jsonEditorDidMount(editor, monaco) {
        this.jsonEditor = editor;
        editor.decorations = [];
    }

    bindingsEditorDidMount(editor, monaco) {
        console.log('editorDidMount', editor);
        this.bindingsEditor = editor;
        editor.decorations = [];
    }

    jsonataEditorDidMount(editor, monaco) {
        this.monaco = monaco;
        this.jsonataEditor = editor;
        editor.decorations = [];

        editor.addAction({
            id: 'jsonata-lambda',
            label: 'Lambda',
            keybindings: [monaco.KeyCode.F11],
            run: function (ed) {
                ed.trigger('keyboard', 'type', { text: "λ" });
                return null;
            }
        });
        const loader = this.loadJSONata.bind(this);
        editor.addAction({
            id: 'jsonata-local',
            label: 'Local Mode',
            keybindings: [monaco.KeyCode.F7],
            run: function (ed) {
                loader("local");
                return null;
            }
        });
    }

    onChangeData(newValue, e) {
        this.setState({ json: newValue });
        clearTimeout(this.timer);
        this.timer = setTimeout(this.eval.bind(this), 500);
        this.clearMarkers();

        try {
            const jsonData = JSON.parse(newValue);
            if (jsonData && jsonData.screenshot) {
                console.log("Updating the screenshot");
                this.setState({ screenshotBase64: jsonData.screenshot });
            } else {
                this.setState({ screenshotBase64: null });
            }
            this.eval();
        } catch (error) {
            console.error('Error parsing JSON:', error);
        }
    }

    onChangeBindings(newValue, e) {
        this.setState({ bindings: newValue });
        console.log('onChangeBindings', newValue, e);
        clearTimeout(this.timer);
        this.timer = setTimeout(this.eval.bind(this), 500);
        this.clearMarkers();
    }

    onChangeExpression(newValue, e) {
        this.setState({ jsonata: newValue });
        clearTimeout(this.timer);
        this.timer = setTimeout(this.eval.bind(this), 500);
        this.clearMarkers();
    }

    onChangeExternalLibraries(libs) {
        this.setState({ externalLibs: libs });
        console.log('onChangeExternalLibraries', libs);
        clearTimeout(this.timer);
        this.timer = setTimeout(this.eval.bind(this), 500);
        this.clearMarkers();
    }

    format() {
        const formatted = JSON.stringify(JSON.parse(this.state.json), null, 2);
        this.setState({ json: formatted });
    }

    changeVersion(event) {
        this.loadJSONata(event.target.value, false);
        this.timer = setTimeout(this.eval.bind(this), 100);
        this.clearMarkers();
    }

    loadJSONata(version, isBranch) {
        const head = document.getElementsByTagName('head')[0];
        const script = document.createElement('script');
        const label = document.getElementById('version-label');
        script.type = 'text/javascript';
        if (version === 'local') {
            script.src = 'http://localhost:3009/jsonata.js';
            label.innerHTML = '** Local **';
            this.local = true;
        } else if (isBranch) {
            script.src = 'https://rawgit.com/jsonata-js/jsonata/' + version + '/jsonata.js';
            label.innerHTML = '** ' + version + ' **';
        } else {
            version = version ? '@' + version : "";
            script.src = 'https://cdn.jsdelivr.net/npm/jsonata' + version + '/jsonata.min.js';
            label.innerHTML = version;
            this.local = false;
        }
        head.appendChild(script);
    }

    async eval() {
        let input, jsonataResult, bindings, jsonataResult_Java;

        if (typeof window.jsonata === 'undefined') {
            this.timer = setTimeout(this.eval.bind(this), 500);
            return;
        }

        try {
            if (typeof this.state.json !== 'undefined' && this.state.json !== '') {
                input = JSON.parse(this.state.json);
            } else {
                input = undefined;
            }
        } catch (err) {
            console.log(err);
            this.setState({ result: 'ERROR IN INPUT DATA: ' + err.message });
            const pos = err.message.indexOf('at position ');
            console.log('pos=', pos);
            if (pos !== -1) {
                console.log(err);
                const start = parseInt(err.message.substr(pos + 12)) + 1;
                this.errorMarker(start, start + 1, this.jsonEditor, this.state.json);
            }
            return;
        }
  
        try {
            if (this.state.jsonata !== '') {
                jsonataResult_Java = await this.evalJsonata_java(input, null);
            } else {
                jsonataResult_Java = '^^ Enter a JSONata expression in the box above ^^';
            }
            this.setState({ result_java: jsonataResult_Java });
        } catch (err) {
            this.setState({ result_java: err.message || String(err) });
            console.log(err);
        }
    }

    errorMarker(start, end, editor, buffer) {
        const resolve = offset => {
            let line = 1;
            let column = 1;
            let position = 1;
            while (position < offset) {
                if (buffer.charAt(position) === '\n') {
                    line++;
                    column = 0;
                } else {
                    column++;
                }
                position++;
            }
            return { line, column };
        };
        const from = resolve(start);
        const to = resolve(end);
        editor.decorations = editor.deltaDecorations(editor.decorations, [
            { range: new this.monaco.Range(from.line, from.column, to.line, to.column), options: { inlineClassName: 'jsonataErrorMarker' } },
            { range: new this.monaco.Range(from.line, 1, to.line, 1), options: { isWholeLine: true, linesDecorationsClassName: 'jsonataErrorMargin' } },
        ]);
    }

    clearMarkers() {
        this.jsonataEditor.decorations = this.jsonataEditor.deltaDecorations(this.jsonataEditor.decorations, []);
        this.jsonEditor.decorations = this.jsonEditor.deltaDecorations(this.jsonEditor.decorations, []);
    }

    async evalJsonata(input, bindings) {
        const expr = window.jsonata(this.state.jsonata);

        expr.assign('trace', function (arg) {
            console.log(arg);
        });

        if (!this.local) {
            this.timeboxExpression(expr, 1000, 500);
        }

        let pathresult = await expr.evaluate(input, bindings);
        if (typeof pathresult === 'undefined') {
            pathresult = '** no match **';
        } else {
            pathresult = JSON.stringify(pathresult, function (key, val) {
                return (typeof val !== 'undefined' && val !== null && val.toPrecision) ? Number(val.toPrecision(13)) :
                    (val && (val._jsonata_lambda === true || val._jsonata_function === true)) ? '{function:' + (val.signature ? val.signature.definition : "") + '}' :
                        (typeof val === 'function') ? '<native function>#' + val.length : val;
            }, 2);
        }
        return pathresult;
    }

    async evalJsonata_java(input, bindings) {
        var data = new FormData();
        data.append('json', JSON.stringify(input));
        data.append('rule', this.state.jsonata);
        var text_result = null;
        try {
            const response = await fetch('https://jsonata.appleby-analytics.com/parseJsonata', {
                body: data,
                method: 'POST'
            });
        
            if (!response.ok) {
                throw new Error('Failed to evaluate JSONata expression');
            }
        
            try {
                const text = await response.text();
                let pathresult;
        
                try {
                    pathresult = JSON.parse(text);
                } catch (jsonError) {
                    throw new Error(text);
                }
        
                if (typeof pathresult === 'undefined') {
                    pathresult = '** no match **';
                } else {
                    text_result = pathresult;
        
                    pathresult = JSON.stringify(pathresult, function (key, val) {
                        return (typeof val !== 'undefined' && val !== null && val.toPrecision) ? Number(val.toPrecision(13)) :
                            (val && (val._jsonata_lambda === true || val._jsonata_function === true)) ? '{function:' + (val.signature ? val.signature.definition : "") + '}' :
                                (typeof val === 'function') ? '<native function>#' + val.length : val;
                    }, 2);
                }
                return pathresult;
        
            } catch (error) {
                console.error('Error parsing JSON response:', error);
                return '** invalid JSON response ** ' + error;
            }
        
        } catch (error) {
            console.error('Error evaluating JSONata expression:', error);
            return '** evaluation error ** ' + error + "\n" + text_result;
        }
        
    }

    timeboxExpression(expr, timeout, maxDepth) {
        let depth = 0;
        const time = Date.now();

        const checkRunnaway = function () {
            if (depth > maxDepth) {
                throw new Error('Stack overflow error: Check for non-terminating recursive function. Consider rewriting as tail-recursive.');
            }
            if (Date.now() - time > timeout) {
                throw new Error("Expression evaluation timeout: Check for infinite loop");
            }
        };

        expr.assign('__evaluate_entry', function (expr, input, environment) {
            depth++;
            checkRunnaway();
        });
        expr.assign('__evaluate_exit', function (expr, input, environment, result) {
            depth--;
            checkRunnaway();
        });
    }

    render() {
        const options = {
            minimap: { enabled: false },
            lineNumbers: 'off',
            contextmenu: false,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            extraEditorClassName: 'editor-pane'
        };
    
        const { screenshotBase64 } = this.state;
    
        return (
            <div className="App">
                <header className="App-header">
                    <div id="banner">
                        <div id="banner-strip" className="bannerpart">
                            <div id="banner1">Rule Developer</div>
                            <div id="banner4">
                                <a href="http://docs.jsonata.org"><img src={docs} alt="Documentation" /></a>
                            </div>
                        </div>
                    </div>
                </header>
                <RecordList onSelectRecord={this.onSelectRecord.bind(this)} />
                <SplitPane split="vertical" minSize={100} defaultSize={'30%'}>
                    <div className="pane">
                        <ScreenshotComponent base64WebPImage={screenshotBase64} style={{ width: '100%', height: '100%' }} />
                    </div>
                    <SplitPane split="vertical" minSize={100} defaultSize={'50%'}>
                        
                            <div className="pane">
                                <MonacoEditor
                                    language="json"
                                    theme="jsonataTheme"
                                    value={this.state.json}
                                    options={options}
                                    onChange={this.onChangeData.bind(this)}
                                    editorDidMount={this.jsonEditorDidMount.bind(this)}
                                />
                                <div id="json-label" className="label">JSON</div>
                                <img src={format} id="json-format" title="Format" onClick={this.format.bind(this)} alt={"Format"} />
                            </div>
                           
                      
                        <SplitPane split="horizontal" minSize={50} defaultSize={170}>
                            <div className="pane">
                                <MonacoEditor
                                    language="jsonata"
                                    theme="jsonataTheme"
                                    value={this.state.jsonata}
                                    options={options}
                                    onChange={this.onChangeExpression.bind(this)}
                                    editorWillMount={jsonataMode.bind(this)}
                                    editorDidMount={this.jsonataEditorDidMount.bind(this)}
                                />
                                <div id="jsonata-label" className="label">JSONata</div>
                                <select id="version-select" onChange={this.changeVersion.bind(this)}></select>
                                <div id="version-label" className="label"></div>
                            </div>
                            <div className="pane">
                                <MonacoEditor
                                    language="json"
                                    theme="jsonataTheme"
                                    value={this.state.result}
                                    options={{
                                        lineNumbers: 'off',
                                        minimap: { enabled: false },
                                        automaticLayout: true,
                                        contextmenu: false,
                                        scrollBeyondLastLine: false,
                                        readOnly: true,
                                        extraEditorClassName: 'result-pane'
                                    }}
                                />
                                <MonacoEditor
                                    language="json"
                                    theme="jsonataTheme"
                                    value={this.state.result_java}
                                    options={{
                                        lineNumbers: 'off',
                                        minimap: { enabled: false },
                                        automaticLayout: true,
                                        contextmenu: false,
                                        scrollBeyondLastLine: false,
                                        readOnly: true,
                                        extraEditorClassName: 'result-pane-java'
                                    }}
                                />
                            </div>
                        </SplitPane>
                    </SplitPane>
                </SplitPane>
            </div>
        );
    }
    
    
}

export default Exerciser;
