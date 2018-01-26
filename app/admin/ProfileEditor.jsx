import axios from "axios";
import React, {Component} from "react";
import {Card, Dialog} from "@blueprintjs/core";
import GeneratorEditor from "./GeneratorEditor";
import TextEditor from "./TextEditor";

import "./ProfileEditor.css";

class ProfileEditor extends Component {

  constructor(props) {
    super(props);
    this.state = {
      data: null,
      builders: null,
      variables: null,
      preview: "04000US25"
    };
  }

  componentDidMount() {
    const {data, builders} = this.props;
    this.setState({data, builders}, this.compileVariables.bind(this));   
  }

  componentDidUpdate() {
    if (this.props.data.id !== this.state.data.id) {
      this.setState({data: this.props.data});
    }
  }

  compileVariables() {
    const {slug} = this.state.data;
    const id = this.state.preview;
    axios.get(`/api/profile/${slug}/${id}`).then(resp => {
      const {variables} = resp.data;
      this.setState({variables}, this.formatDisplays.bind(this));
    });
  }

  formatDisplays() {
    const {builders, variables} = this.state;
    const data = this.displayify(this.state.data);
    if (data.stats) data.stats = data.stats.map(s => this.displayify(s));
    // TODO, get Dave's help on this
    for (const b of [builders.generators, builders.materializers]) {
      for (const g of b) {
        g.display_vars = [];
        for (const key in variables) {
          if (g.logic.includes(`${key}:`)) {
            g.display_vars.push(`${key}: ${variables[key]}`);
          }
        }
      }
    }
    this.setState({data, builders});
  }

  displayify(sourceObj) {
    const {variables} = this.state;
    for (const skey in sourceObj) {
      if (sourceObj.hasOwnProperty(skey) && typeof sourceObj[skey] === "string") {
        sourceObj[`display_${skey}`] = sourceObj[skey];
        const re = new RegExp(/([A-z0-9]*)\{\{([A-z0-9]+)\}\}/g);
        let m;
        do {
          m = re.exec(sourceObj[`display_${skey}`]);
          if (m) {
            // const formatter = m[1] ? formatterFunctions[m[1]] : d => d;
            const formatter = d => d;
            sourceObj[`display_${skey}`] = sourceObj[`display_${skey}`].replace(m[0], formatter(variables[m[2]]));
            //sourceObj[skey] = sourceObj[skey].replace(m[0], formatter(variables[m[2]]));
          }
        } while (m);
      }
    }
    return sourceObj;
  }

  changeField(field, e) {
    const {data} = this.state;
    data[field] = e.target.value;
    this.setState({data});
  }

  handleEditor(field, t) {
    const {data} = this.state;
    data[field] = t;
    this.setState({data});    
  }

  saveItem(item, type) {
    if (type === "generator" || type === "materializer") {
      axios.post(`/api/${type}/update`, item).then(resp => {
        if (resp.status === 200) {
          this.setState({isGeneratorEditorOpen: false}, this.compileVariables());
        } 
      });
    }
  }

  deleteItem(item, type) {
    const {data, builders} = this.state;
    if (type === "generator") {
      builders.generators = builders.generators.filter(g => g.id !== item.id);
      this.setState({builders}, this.closeWindow("isGeneratorEditorOpen"));
    }
  }

  addItem(type) {
    const {data, builders} = this.state;
    if (type === "generator") {
      builders.generators.push({
        id: new Date().getTime(),
        name: "New Generator",
        api: "/api/route/",
        description: "New Description",
        logic: "return {}",
        profile_id: this.state.data.id
      });
      this.setState({builders});
    }
    else if (type === "materializer") {
      builders.materializers.push({
        id: new Date().getTime(),
        name: "New Materializer",
        description: "New Description",
        logic: "return {}",
        profile_id: this.state.data.id
      });
      this.setState({builders});
    }
    else if (type === "stat") {
      data.stats.push({
        id: new Date().getTime(),
        title: "New Title",
        subtitle: "New Subtitle",
        value: "New Value",
        owner_type: "profile",
        profile_id: this.state.data.id
      });
      this.setState({data});
    }
    else if (type === "visualization") {
      data.visualizations.push({
        id: new Date().getTime(),
        logic: "return {}",
        owner_type: "profile",
        profile_id: this.state.data.id
      });
      this.setState({data});
    }
  }

  /*
  saveContent() {
    const {data} = this.state;
    if (this.props.reportSave) this.props.reportSave(data);
    const toast = Toaster.create({className: "saveToast", position: Position.TOP_CENTER});
    axios.post("/api/builder/islands/save", data).then(resp => {
      if (resp.status === 200) {
        toast.show({message: "Saved!", intent: Intent.SUCCESS});
      } 
      else {
        toast.show({message: "Error!", intent: Intent.DANGER});
      }
    });
  }
  */

  openGeneratorEditor(g, type) {
    this.setState({currentGenerator: g, currentGeneratorType: type, isGeneratorEditorOpen: true});
  }

  openTextEditor(t, fields) {
    this.setState({currentText: t, currentFields: fields, isTextEditorOpen: true});
  }

  closeWindow(key) {
    this.setState({[key]: false}, this.compileVariables.bind(this));
  }

  render() {

    const {data, builders, currentGenerator, currentGeneratorType, currentText, currentFields} = this.state;

    if (!data || !builders) return null;



    const generators = builders.generators.map(g =>
      <Card key={g.id} onClick={this.openGeneratorEditor.bind(this, g, "generator")} className="generator-card" interactive={true} elevation={Card.ELEVATION_ONE}>
        <h5>{g.name}</h5>
        <ul>
          {g.display_vars ? g.display_vars.map(v => <li key={`g${v}`}>{v}</li>) : null} 
        </ul>
      </Card>
    );

    const materializedGenerators = builders.materializers.map(m => 
      <Card key={m.id} onClick={this.openGeneratorEditor.bind(this, m, "materializer")} className="generator-card" interactive={true} elevation={Card.ELEVATION_ONE}>
        <h5>{m.name}</h5>
        <ul>
          {m.display_vars ? m.display_vars.map(v => <li key={`m${v}`}>{v}</li>) : null} 
        </ul>
      </Card>
    );

    const stats = data.stats.map(s => 
      <Card key={s.id} onClick={this.openTextEditor.bind(this, s, ["title", "subtitle", "value"])} className="stat-card" interactive={true} elevation={Card.ELEVATION_ONE}>
        <h6>title</h6>
        <div dangerouslySetInnerHTML={{__html: s.display_title}} />
        <h6>subtitle</h6>
        <div dangerouslySetInnerHTML={{__html: s.display_subtitle}} />
        <h6>value</h6>
        <div dangerouslySetInnerHTML={{__html: s.display_value}} />
      </Card>
    );

    const visualizations = data.visualizations.map(v =>
      <Card key={v.id} onClick={this.openGeneratorEditor.bind(this, v, "visualization")} className="visualization-card" interactive={true} elevation={Card.ELEVATION_ONE}>
        <p>{v.logic}</p>
      </Card>
    );

    return (
      <div id="profile-editor">
        
        <Dialog
          iconName="code"
          isOpen={this.state.isGeneratorEditorOpen}
          onClose={this.closeWindow.bind(this, "isGeneratorEditorOpen")}
          title="Variable Editor"
          style={{minWidth: "800px"}}
        >
          <div className="pt-dialog-body">
            <GeneratorEditor data={currentGenerator} type={currentGeneratorType} />
          </div>
          <div className="pt-dialog-footer">
            <div className="pt-dialog-footer-actions">
              <button 
                className="pt-button pt-intent-danger"
                onClick={this.deleteItem.bind(this, currentGenerator, currentGeneratorType)}
              >
                Delete
              </button>
              <button 
                className="pt-button"
                onClick={() => this.setState({isGeneratorEditorOpen: false})}
              >
                Cancel
              </button>
              <button
                className="pt-button pt-intent-success"
                onClick={this.saveItem.bind(this, currentGenerator, currentGeneratorType)}
              >
                Save
              </button>
            </div>
          </div>
        </Dialog>

        <Dialog
          iconName="document"
          isOpen={this.state.isTextEditorOpen}
          onClose={this.closeWindow.bind(this, "isTextEditorOpen")}
          title="Text Editor"
        >
          <div className="pt-dialog-body">
            <TextEditor data={currentText} fields={currentFields} />
          </div>
          <div className="pt-dialog-footer">
            <div className="pt-dialog-footer-actions">
              <button 
                className="pt-button pt-intent-danger"
                onClick={() => this.setState({isTextEditorOpen: false})}
              >
                Cancel
              </button>
              <button
                className="pt-button pt-intent-success"
                onClick={() => this.setState({isTextEditorOpen: false})}
              >
                Save
              </button>
            </div>
          </div>
        </Dialog>

        <div id="preview-as">
          Hard Code Previewing as <strong>{this.state.preview}</strong>
        </div>

        <div id="slug">
          <label className="pt-label">
            slug
            <input className="pt-input" style={{width: "180px"}} type="text" dir="auto" value={data.slug} onChange={this.changeField.bind(this, "slug")}/>
          </label>
        </div>
        
        <div className="generators">
          <div className="cms-header">
            DATABASE VARIABLE GENERATORS
          </div>
          <div className="generator-cards">
            {generators}
            <Card className="generator-card" onClick={this.addItem.bind(this, "generator")} interactive={true} elevation={Card.ELEVATION_ONE}>
              <h5>Add New</h5>
              <p>+</p>
            </Card>
          </div>
        </div>

        <div className="materialized-generators">
          <div className="cms-header">
            MATERIALIZED VARIABLE GENERATORS
          </div>
          <div className="generator-cards">
            {materializedGenerators}
            <Card className="generator-card" onClick={this.addItem.bind(this, "materializer")} interactive={true} elevation={Card.ELEVATION_ONE}>
              <h5>Add New</h5>
              <p>+</p>
            </Card>
          </div>
        </div>

        <div className="splash">
          <div className="cms-header">
            SPLASH
          </div>
          <Card className="splash-card" onClick={this.openTextEditor.bind(this, data, ["title", "subtitle", "description"])} interactive={true} elevation={Card.ELEVATION_ONE}>
            <h6>title</h6>
            <div dangerouslySetInnerHTML={{__html: data.display_title}} /><br/>
            <h6>subtitle</h6>
            <div dangerouslySetInnerHTML={{__html: data.display_subtitle}} /><br/>
            <h6>description</h6>
            <div dangerouslySetInnerHTML={{__html: data.display_description}} /><br/>
          </Card>
        </div>

        <div className="stats">
          <div className="cms-header">
            STATS
          </div>
          <div>
            {stats}
            <Card className="stat-card" onClick={this.addItem.bind(this, "stat")} interactive={true} elevation={Card.ELEVATION_ONE}>
              <h5>Add New</h5>
              <p>+</p>
            </Card>
          </div>
        </div>

        <div className="visualizations">
          <div className="cms-header">
            VISUALIZATIONS
          </div>
          <div>
            {visualizations}
            <Card className="visualization-card" onClick={this.addItem.bind(this, "visualization")} interactive={true} elevation={Card.ELEVATION_ONE}>
              <h5>Add New</h5>
              <p>+</p>
            </Card>
          </div>
        </div>

      </div>
    );
  }
}

export default ProfileEditor;
