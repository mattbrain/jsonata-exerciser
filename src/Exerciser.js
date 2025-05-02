import React from 'react';
import SplitPane from 'react-split-pane';
import MonacoEditor from 'react-monaco-editor';
import ScreenshotComponent from './ScreenshotComponent';
import format from './images/format.png';
import docs from './images/docs-white-32.png';
import jsonataMode from './jsonataMode';
import { getLibraryHandle } from './externalLibsComponent';
import RecordList from './RecordList';
import axios from 'axios';
  const url = 'https://jsonata.appleby-analytics.com/api/';
 
  //const url = 'http://localhost:3001/api/';


const baseUri = 'https://us-south.functions.appdomain.cloud/api/v1/web/04d6b400-5947-46c6-ae3e-ebdf4a7056de/default/';

class Exerciser extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            json: '{}',
            jsonata: '',
            bindings: '',
            result: '',
            panelStates: {
                bindings: 'hidden'
            },
            externalLibs: [],
            webpImage: null,
            evalMode: 'java', // NEW: Default eval mode
            ruleNames: [],
            selectedRule: null,
            ruleData: null,
            ruleName: ''
        };
    }

    async getRuleNames() {
        try {
            const response = await fetch(url + 'get_rule_names');
            const data = await response.json();
            this.setState({ ruleNames: data });
        } catch (error) {
            console.error('Error fetching rule names:', error);
        }
    }
    async getRule() {
        try {
            const response = await fetch(url + 'get_rule/' + this.state.selectedRule);
            const jsonataExpr = await response.text(); // 👈 it's plain text, not JSON
            this.setState({ jsonata: jsonataExpr });
        } catch (error) {
            console.error('Error fetching rule:', error);
        }
    }
    
    async saveRule() {
        try {
            const data = {
                rule: this.state.jsonata,
                rule_name: this.state.ruleName,
            };
            const response = await fetch(url + 'save_rule/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
    
            const result = await response.json();
            console.log('Rule saved:', result);
    
            // Show confirmation dialog
            window.alert('Rule saved successfully!');
    
            // Clear rule name
            this.setState({ ruleName: '' });
    
            this.getRuleNames();
        } catch (error) {
            console.error('Error saving rule:', error);
            window.alert('Failed to save rule. See console for details.');
        }
    }
    

    async deleteRule() {
        try {
            const response = await fetch(url + 'delete_rule/' + this.state.selectedRule, {
                method: 'DELETE',
            });
            const result = await response.json();
            console.log('Rule deleted:', result);
            this.getRuleNames();
        } catch (error) {
            console.error('Error deleting rule:', error);
        }
    }

    setPanelState(panel, state) {
        this.setState({ panelStates: { ...this.state.panelStates, [panel]: state } });
    }

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
        this.getRuleNames();
        this.loadJSONata();
        fetch(baseUri + 'jsonata-versions.json')
            .then(res => res.json())
            .then(
                result => {
                    if (process.env.NODE_ENV === 'development') {
                        result.versions.unshift('local');
                    }
                    const select = document.getElementById('version-select');
                    result.versions.forEach(tag => {
                        const option = document.createElement("option");
                        option.text = tag;
                        option.value = tag;
                        select.add(option);
                    });
                    this.loadJSONata(result.versions[0]);
                },
                error => console.log(error)
            );

        if (this.props.data) {
            this.setState({ json: 'Loading...', jsonata: 'Loading...' });
            const self = this;
            fetch(baseUri + 'get-shared.json?id=' + this.props.data)
                .then(res => res.json())
                .then(result => {
                    return Promise.all([Promise.resolve(result), this.getExternalLibsInitialized(result.externalLibs)])
                })
                .then(async ([result, externalLibs]) => {
                    this.setState({
                        json: result.json ? JSON.stringify(result.json, null, 2) : '',
                        jsonata: result.jsonata,
                        bindings: result.bindings !== undefined ? result.bindings : '{\n  // name: value\n}',
                        externalLibs: externalLibs,
                        result: ''
                    });
                    await self.eval();
                },
                error => console.log(error)
            )
        } else {
            this.eval();
        }
    }

    getExternalLibsInitialized(externalLibs = []) {
        const allPromises = externalLibs.map(lib => {
            return fetch(lib.url)
                .then(res => res.ok ? res.text() : undefined)
                .then(libFileText => {
                    if (!libFileText) return undefined;
                    const libraryContext = getLibraryHandle(libFileText, lib.moduleName);
                    return { ...lib, libraryContext: { [lib.moduleName]: libraryContext } };
                });
        });

        return Promise.all(allPromises);
    }

    jsonEditorDidMount(editor, monaco) {
        this.jsonEditor = editor;
        editor.decorations = [];
    }

    bindingsEditorDidMount(editor, monaco) {
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
            run: ed => {
                ed.trigger('keyboard', 'type', { text: "λ" });
                return null;
            }
        });
        const loader = this.loadJSONata.bind(this);
        editor.addAction({
            id: 'jsonata-local',
            label: 'Local Mode',
            keybindings: [monaco.KeyCode.F7],
            run: () => loader("local")
        });
    }

    onChangeData(newValue) {
        this.setState({ json: newValue });
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.eval(), 500);
        this.clearMarkers();

        try {
            const jsonData = JSON.parse(newValue);
            if (jsonData && jsonData.screenshot) {
                this.setState({ screenshotBase64: jsonData.screenshot });
            } else {
                this.setState({ screenshotBase64: null });
            }
        } catch (error) {
            console.error('Error parsing JSON:', error);
        }
    }

    onChangeBindings(newValue) {
        this.setState({ bindings: newValue });
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.eval(), 500);
        this.clearMarkers();
    }

    onChangeExpression(newValue) {
        this.setState({ jsonata: newValue });
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.eval(), 500);
        this.clearMarkers();
    }

    format() {
        const formatted = JSON.stringify(JSON.parse(this.state.json), null, 2);
        this.setState({ json: formatted });
    }

    changeVersion(event) {
        this.loadJSONata(event.target.value, false);
        this.timer = setTimeout(() => this.eval(), 100);
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
        let input;
        if (typeof window.jsonata === 'undefined') {
            this.timer = setTimeout(() => this.eval(), 500);
            return;
        }

        try {
            input = this.state.json ? JSON.parse(this.state.json) : undefined;
        } catch (err) {
            this.setState({ result: 'ERROR IN INPUT DATA: ' + err.message });
            return;
        }

        let resultText;
        try {
            if (this.state.jsonata !== '') {
                if (this.state.evalMode === 'java') {
                    resultText = await this.evalJsonata_java(input, null);
                } else {
                    resultText = await this.evalJsonata(input, null);
                }
            } else {
                resultText = '^^ Enter a JSONata expression in the box above ^^';
            }
        } catch (err) {
            resultText = err.message || String(err);
        }

        this.setState({ result: resultText });
    }

    async evalJsonata(input, bindings) {
        const expr = window.jsonata(this.state.jsonata);
        expr.assign('trace', arg => console.log(arg));
        if (!this.local) this.timeboxExpression(expr, 1000, 500);

        let pathresult = await expr.evaluate(input, bindings);
        if (typeof pathresult === 'undefined') {
            pathresult = '** no match **';
        } else {
            pathresult = JSON.stringify(
                pathresult,
                (key, val) => 
                    (val && val.toPrecision) ? Number(val.toPrecision(13)) :
                    (val && (val._jsonata_lambda || val._jsonata_function)) ? '{function}' :
                    (typeof val === 'function') ? '<native function>' : val,
                2
            );
        }
        return pathresult;
    }

    async evalJsonata_java(input, bindings) {
        const data = new FormData();
        data.append('json', JSON.stringify(input));
        data.append('rule', this.state.jsonata);

        try {
            const response = await fetch('https://jsonata.appleby-analytics.com/parseJsonata', {
                method: 'POST',
                body: data
            });

            if (!response.ok) throw new Error('Failed to evaluate JSONata expression');

            const text = await response.text();
            let pathresult;

            try {
                pathresult = JSON.parse(text);
            } catch {
                throw new Error(text);
            }

            return JSON.stringify((pathresult !== undefined && pathresult !== null) ? pathresult : '** no match **', null, 2);


        } catch (error) {
            return '** evaluation error ** ' + error;
        }
    }

    timeboxExpression(expr, timeout, maxDepth) {
        let depth = 0;
        const time = Date.now();
        const check = () => {
            if (depth > maxDepth) throw new Error('Stack overflow');
            if (Date.now() - time > timeout) throw new Error("Timeout");
        };
        expr.assign('__evaluate_entry', () => { depth++; check(); });
        expr.assign('__evaluate_exit', () => { depth--; check(); });
    }

    clearMarkers() {
        this.jsonataEditor.decorations = this.jsonataEditor.deltaDecorations(this.jsonataEditor.decorations, []);
        this.jsonEditor.decorations = this.jsonEditor.deltaDecorations(this.jsonEditor.decorations, []);
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

                <div className="toolbar">

                        <select
                            id="eval-mode-select"
                            value={this.state.evalMode}
                            onChange={e => this.setState({ evalMode: e.target.value }, () => this.eval())}
                            style={{ marginLeft: '20px', fontSize: '14px', padding: '4px' }}
                        >
                            <option value="java">Java (Server)</option>
                            <option value="js">JS (Local)</option>
                        </select>

                        <select
                            id="rule-name-select"
                            value={this.state.selectedRule || ''}
                            onChange={e => this.setState({ selectedRule: e.target.value }, () => this.getRule(this.state.selectedRule))}
                            style={{ marginLeft: '20px', fontSize: '14px', padding: '4px' }}
                        >
                            <option value="">Select Rule</option>
                            {(this.state.ruleNames || []).map(ruleName => (
                                <option key={ruleName} value={ruleName}>
                                    {ruleName}
                                </option>
                            ))}
                        </select>
                        <button
                        onClick={() => {
                            if (window.confirm(`Are you sure you want to delete the rule "${this.state.selectedRule}"?`)) {
                                this.deleteRule();
                            }
                        }}
                        disabled={!this.state.selectedRule}
                        style={{ marginLeft: '20px', fontSize: '14px', padding: '4px' }}
                    >
                        Delete Rule
                    </button>



                        <input
                            type="text"
                            value={this.state.ruleName}
                            onChange={e => this.setState({ ruleName: e.target.value })}
                            placeholder="Rule Name"
                            style={{ marginLeft: '20px', fontSize: '14px', padding: '4px' }}
                        />
                    
                            
                         <button
                            onClick={() => this.saveRule()}
                            disabled={!(this.state.ruleName && this.state.ruleName.length >= 5)}
                            style={{ marginLeft: '20px', fontSize: '14px', padding: '4px' }}
                        >
                            Save Rule
                        </button>

                </div>
 
                               
              

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
                                <label id="version-label" className="label"></label>
                 
                            </div>
               
                            <div className="pane">
                                <MonacoEditor
                                    language="json"
                                    theme="jsonataTheme"
                                    value={`// Result from ${this.state.evalMode === 'java' ? 'Java (Server)' : 'JS (Local)'}\n${this.state.result}`}
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
                            </div>
                        </SplitPane>
                    </SplitPane>
                </SplitPane>
            </div>
        );
    }
}

export default Exerciser;