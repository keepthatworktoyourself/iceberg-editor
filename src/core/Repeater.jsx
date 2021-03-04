import React from 'react';
import * as DnD from 'react-beautiful-dnd';
import PageDataContext from './PageDataContext';
import Utils from './definitions/utils';
import NestedBlockWrapper from './NestedBlockWrapper';
import RepeaterItem from './RepeaterItem';
import RecursiveBlockRenderer from './RecursiveBlockRenderer';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faPlusCircle} from '@fortawesome/free-solid-svg-icons';


export default class Repeater extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      collapsed: true,
      show_dialogue: false,
    };

    this.cb__add_btn = this.cb__add_btn.bind(this);
    this.cb__add     = this.cb__add.bind(this);
    this.cb__delete  = this.cb__delete.bind(this);
    this.cb__reorder = this.cb__reorder.bind(this);
  }


  cb__add_btn(ev) {
    const nested_block_types = this.props.field_def.nested_block_types;

    if (nested_block_types.length > 1) {
      this.setState({
        show_dialogue: !this.state.show_dialogue,
      });
    }

    else if (nested_block_types.length === 1) {
      this.cb__add();
    }
  }


  cb__add(ev) {
    function get_block_type(str_or_obj) {
      return typeof str_or_obj === 'string' ? str_or_obj : str_or_obj.type;
    }

    const containing_data_item = this.props.containing_data_item;
    const field_def = this.props.field_def;
    const block_type = ev ?
      ev.currentTarget.getAttribute('data-nested_block-type') :
      get_block_type(this.props.field_def.nested_block_types[0]);

    if (!containing_data_item[field_def.name]) {
      containing_data_item[field_def.name] = [ ];
    }
    containing_data_item[field_def.name].push({ __type: block_type });

    this.setState({
      show_dialogue: false,
    });

    this.ctx.value_updated();
    this.ctx.should_redraw();
    this.ctx.block_toggled();
  }


  cb__delete(i) {
    const data_items = this.props.containing_data_item[this.props.field_def.name];
    data_items.splice(i, 1);

    this.setState({ });

    this.ctx.value_updated();
    this.ctx.should_redraw();
    this.ctx.block_toggled();
  }


  cb__reorder(drag_result) {
    if (!drag_result.destination || !drag_result.source) {
      return;
    }
    if (drag_result.source.index === drag_result.destination.index) {
      return;
    }

    const data_items = this.props.containing_data_item[this.props.field_def.name];
    const [item] = data_items.splice(drag_result.source.index, 1);
    data_items.splice(drag_result.destination.index, 0, item);

    this.setState({ });
    this.ctx.value_updated();
    this.ctx.should_redraw();
    this.ctx.block_toggled();
  }


  render() {
    const field_def                  = this.props.field_def;
    const containing_data_item       = this.props.containing_data_item;
    const DragDropContext            = this.props.drag_context_component  || DnD.DragDropContext;
    const Droppable                  = this.props.droppable_component     || DnD.Droppable;
    const Draggable                  = this.props.draggable_component     || DnD.Draggable;
    const ContextConsumer            = this.props.consumer_component      || PageDataContext.Consumer;
    const RepeaterItemStub           = this.props.repeater_item_component || RepeaterItem;
    const RecursiveBlockRendererStub = this.props.rbr_component           || RecursiveBlockRenderer;
    const data_items                 = containing_data_item[field_def.name] || [ ];
    const nested_block_types         = field_def.nested_block_types || [ ];
    const max                        = field_def.max || -1;
    const multiple_types             = nested_block_types.length !== 1;
    const dnd_context_id             = `d-${containing_data_item.__uid}-${field_def.name}`;
    const show_add_button            = max === -1 || data_items.length < max;

    return (
      <ContextConsumer>{ctx => {
        this.ctx = ctx;

        const block_types__objects = nested_block_types.map(t => (
          typeof t === 'string' ? Utils.find_block(ctx.blocks, t) : t
        ));

        const invalid = block_types__objects.reduce((carry, block, index) => {
          const is_valid = block && typeof block === 'object' && block.hasOwnProperty('type');
          return is_valid ? carry : carry.concat(index);
        }, [ ]);

        if (invalid.length > 0) {
          const multiple = invalid.length > 1;
          return (
            <p className="repeater-error">{`
              Error: the nested_block_types ${multiple ? 'values' : 'value'} at
              ${multiple ? 'indexes' : 'index'}
              ${invalid.join(',')}
              ${multiple ? 'were' : 'was'} invalid
            `}</p>
          )
        }

        return <>
          <DragDropContext onDragEnd={this.cb__reorder}>
            <Droppable droppableId={dnd_context_id} type={dnd_context_id}>{(prov, snap) => (
              <div ref={prov.innerRef} {...prov.droppableProps}>

                {data_items.map((data_item, index) => (
                  <RepeaterItemStub index={index}
                                    dnd_context_id={dnd_context_id}
                                    dnd_key={data_item.__uid}
                                    key={data_item.__uid || index}
                                    cb__delete={this.cb__delete}>

                    <RecursiveBlockRendererStub data_item={data_item} blocks={ctx.blocks} />

                  </RepeaterItemStub>
                ))}

                {prov.placeholder}

              </div>
            )}</Droppable>
          </DragDropContext>

          {show_add_button && (
            <div className="repeater-add-btn">
              <div className={`dropdown ${this.state.show_dialogue ? 'is-active' : ''}`}>

                <div className="dropdown-trigger">
                  <button className="button is-small" aria-haspopup="true" aria-controls="dropdown-menu"
                          onClick={this.cb__add_btn}>
                    <span className="icon is-small has-text-grey">
                      <FontAwesomeIcon icon={faPlusCircle} />
                    </span>
                    <span>Add</span>
                  </button>
                </div>

                {multiple_types && (
                  <div className="dropdown-menu" id="dropdown-menu" role="menu">
                    <div className="dropdown-content">
                      {block_types__objects.map((block, i) => {
                        return (
                          <a className="dropdown-item" onClick={this.cb__add} key={i} data-nested_block-type={block.type}>
                            {block.description || block.type}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </>
      }}</ContextConsumer>
    );
  }

}

