//
// PostBuilder - top level component, retrieves post data and kicks off rendering
//

import React from 'react';
import * as DnD from 'react-beautiful-dnd';
import Block from './Block';
import AddBlockBtn from './AddBlockBtn';
import PageDataContext from './PageDataContext';


function block_drag_styles(snapshot, provided) {
  const custom_styles = snapshot.isDragging ? {
    backgroundColor: 'rgba(0,0,255, 0.06)',
    border: '3px solid rgba(0,0,255, 0.12)',
  } : { };

  return { ...custom_styles, ...provided.draggableProps.style };
}


// PageDataContext object
// -----------------------------------
// - provides back-communication interface
// - we break this out from Iceberg just to make clear the interface
//   provided

function ctx(pb_instance) {
  return {
    should_update() {
      setTimeout(() => pb_instance.setState({ }), 10);
    },

    add_repeater_item(repeater_uid, type) {
      pb_instance.add_repeater_item(repeater_uid, type);
    },

    remove_repeater_item(repeater_uid, item_uid) {
      pb_instance.remove_repeater_item(repeater_uid, item_uid);
    },

    add_block(type, index) {
      pb_instance.add_block(type, index);
    },

    remove_block(block_uid) {
      pb_instance.remove_block(block_uid);
    },

    blockset: { },
  };
}


// PostBuilder
// -----------------------------------

export default class Iceberg extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      render_blocks: null,
    };

    this.i = 0;
    this.ctx = ctx(this);
    this.repeaters = { };
  }


  // uid()
  // -----------------------------------

  uid() {
    return `uid-${this.i++}`;
  }


  // create_render_block
  // -----------------------------------
  // - create a 'render block' item given a block definition and an
  //   optional data_block of existing data
  // - a 'render block' is a combination of block data and component definitions
  //   that's more convenient for rendering:
  //     {
  //       type: type name,
  //       def:  component definition for block
  //       uid:  a unique ID
  //       fields: {
  //         field_name: {
  //           uid:    a unique ID,
  //           def:    field definition withing component definition
  //           value:  field value - may be a normal value, a subblock, or an array of subblocks
  //         }
  //         ...
  //       }
  //     }

  create_render_block(definition, data_block) {
    const render_block = {
      type: definition.type,
      def: definition,
      uid: this.uid.call(this),
      fields: definition.fields.reduce((accum, field_def) => {
        const field = {
          uid: this.uid.call(this),
          def: field_def,
          value: null,
        };

        if (!field_def) {
          console.log('error: field_def not found', field, data_block, definition);
          return accum;
        }

        if (field_def.type === 'subblock') {
          const sub_data_block = (data_block && data_block[field_def.name]) || null;
          field.value = this.create_render_block(
            field_def.subblock_type,
            sub_data_block
          );
        }

        else if (field_def.type === 'subblock array') {
          const sub_data_blocks = (data_block && data_block[field_def.name]) || [ ];
          field.value = sub_data_blocks.map(block => this.create_render_block(
            this.ctx.blockset.get(block.__type),
            block
          ));

          this.repeaters[field.uid] = field;
        }

        else {
          field.value = data_block && data_block[field_def.name];
        }

        accum[field_def.name] = field;
        return accum;
      }, { }),
    };

    return render_block;
  }


  // get_render_blocks - convert loaded data to 'render blocks' (more useful)
  // -----------------------------------

  get_render_blocks(page_data) {
    const render_blocks = page_data.map(block => this.create_render_block(
      this.ctx.blockset.get(block.__type),
      block
    ));

    render_blocks.forEach(b => b.is_top_level = true);

    return render_blocks;
  }


  // get_plain_data - convert render blocks back to block data, for export
  // -----------------------------------

  get_plain_data() {
    function get_block(render_block) {
      const fields = Object.keys(render_block.fields).filter(f => render_block.fields[f].should_display !== false);

      const block = fields.reduce((accum, field_name) => {
        const field = render_block.fields[field_name];

        if (field.def.type === 'subblock') {
          accum[field_name] = get_block(field.value);
        }

        else if (field.def.type === 'subblock array') {
          accum[field_name] = field.value.map(get_block);
        }

        else {
          accum[field_name] = field.value;
        }

        if (accum[field_name] === '' || accum[field_name] === null || accum[field_name] === undefined) {
          delete accum[field_name];
        }

        return accum;
      }, { });

      block.__type = render_block.def.type;
      return block;
    }

    return this.state.render_blocks.map(get_block);
  }


  // add_repeater_item()
  // -----------------------------------

  add_repeater_item(repeater_uid, type) {
    const repeater = this.repeaters[repeater_uid];
    if (repeater) {
      const item = this.create_render_block(type, null);
      repeater.value.push(item);
      this.ctx.should_update();
    }
  }


  // remove_repeater_item()
  // -----------------------------------

  remove_repeater_item(repeater_uid, item_uid) {
    const repeater = this.repeaters[repeater_uid];
    if (repeater) {
      repeater.value = repeater.value.filter(item => item.uid !== item_uid);
      this.ctx.should_update();
    }
  }


  // add_block()
  // -----------------------------------

  add_block(type, index) {
    const b = this.create_render_block(this.ctx.blockset.get(type));
    b.is_top_level = true;
    if (typeof index === 'number') {
      this.state.render_blocks.splice(index, 0, b);
    }
    else {
      this.state.render_blocks.push(b);
    }

    this.ctx.should_update();
  }


  // remove_block()
  // -----------------------------------

  remove_block(block_uid) {
    this.setState({ render_blocks: this.state.render_blocks.filter(block => block.uid !== block_uid) });
  }


  // cb_drag_end()
  // -----------------------------------

  cb_reorder(drag_result) {
    if (!drag_result.destination) {
      return;
    }
    if (drag_result.source.index === drag_result.destination.index) {
      return;
    }

    const is_block_reorder = (
      drag_result.destination.droppableId === 'd-blocks' &&
      drag_result.source.droppableId === 'd-blocks'
    );
    const is_repeater_reorder = !is_block_reorder;  // Condition may need tightening

    if (is_block_reorder) {
      const d = this.state.render_blocks;

      const [item] = d.splice(drag_result.source.index, 1);
      d.splice(drag_result.destination.index, 0, item);

      this.setState({ render_blocks: d });
    }

    else if (is_repeater_reorder) {
      const repeater_field = this.repeaters[drag_result.source.droppableId];
      if (repeater_field) {
        const arr = repeater_field.value;
        const [item] = arr.splice(drag_result.source.index, 1);
        arr.splice(drag_result.destination.idnex, 0, item);

        this.setState({ render_blocks: this.state.render_blocks });
      }
    }
  }


  // cb_save
  // -----------------------------------

  save() {
    const data = this.get_plain_data();
    this.props.ext_interface && this.props.ext_interface.on_update(data);
  }


  // render()
  // -----------------------------------

  render() {
    let inner;
    const load_state = this.props.load_state;
    this.ctx.blockset = this.props.blockset;


    function msg_div(msg) {
      return <div className="bg-solid has-text-centered" style={{ padding: '1rem' }}>{msg}</div>;
    }

    if (load_state === 'error') {
      inner = msg_div(`Couldn’t load post data`);
    }

    else if (load_state === 'no post') {
      inner = msg_div(`No post specified!`);
    }

    else if (!load_state === 'loading') {
      inner = msg_div(`Loading...`);
    }

    else if (load_state === 'loaded') {
      let render_blocks = this.state.render_blocks;
      if (!render_blocks) {
        this.state.render_blocks = render_blocks = this.get_render_blocks(this.props.data);
      }

      const n_blocks = render_blocks.length;
      inner = (
        <PageDataContext.Provider value={this.ctx}>

          <div className="container" style={{ minHeight: '15rem' }}>
            <div style={{ margin: '1rem' }}>
              <a className="button" onClick={_ => this.save.call(this)}>Save</a>
            </div>

              <DnD.DragDropContext onDragEnd={this.cb_reorder.bind(this)}>
                <DnD.Droppable droppableId="d-blocks" type="block">{(prov, snap) => (
                  <div ref={prov.innerRef} {...prov.droppableProps}>

                    {render_blocks.map((block, index) => (
                      <DnD.Draggable key={`block-${block.uid}`} draggableId={`block-${block.uid}`} index={index} type="block">{(prov, snap) => (

                        <div className="block-list-item" ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps} style={block_drag_styles(snap, prov)}>
                          <Block block={block} block_index={index} ctx={this.ctx} />
                        </div>

                      )}</DnD.Draggable>
                    ))}

                    {prov.placeholder}

                  </div>
                )}</DnD.Droppable>
              </DnD.DragDropContext>

            <div className="is-flex" style={{ justifyContent: 'center' }}>
              <AddBlockBtn cb_select={(ev, type) => this.ctx.add_block(type, null)} popup_direction={n_blocks ? 'up' : 'down'} />
            </div>

          </div>
        </PageDataContext.Provider>
      );
    }

    else {
      inner = msg_div('Unknown load state');
    }

    return (
      <div className="post-builder" style={{ padding: '2rem' }}>
        {inner}
      </div>
    );
  }

}

