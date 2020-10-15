import test from 'ava';
import React from 'react';
import ReactQuill from 'react-quill';
import { shallow, mount, configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import * as DnD from 'react-beautiful-dnd';
import RecursiveBlockRenderer from '../core/RecursiveBlockRenderer';
import test_blocks from './_test-blocks';
import test_data from './_test-data';
import stubs from './_stubs';
import Otter from '..';


configure({ adapter: new Adapter() });


const block = {
  type: 'X',
  fields: [
    {
      name:        'content',
      description: 'Richer text',
      type:        Otter.Fields.TextEditor,
    },
  ],
};
const data_item = {
  __type: 'X',
  content: '<h1>Important message</h1><p>Hi there</p>',
};


function mk_stubbed(field_def, containing_data_item, ctx_methods, is_top_level) {
  const wrapper = shallow(<Otter.Fields.components.TextEditor field_def={field_def}
                                                              containing_data_item={containing_data_item}
                                                              consumer_component={stubs.func_stub([{...ctx_methods}])}
                                                              is_top_level={is_top_level} />);
  return wrapper.dive();
}


test('TextEditor: renders textarea containing initial value', t => {
  const wrapper = mk_stubbed(block.fields[0], data_item, {}, true);
  const quill = wrapper.find(ReactQuill);
  t.is(1, quill.length);
  t.is(data_item.content, quill.prop('defaultValue'));
});


test('TextEditor: value change updates state, calls ctx value_updated only', t => {
  const ctx = {
    value_updated() { ctx.value_updated.called = true; },
    should_redraw() { ctx.should_redraw.called = true; },
  };
  const d = Otter.Utils.copy(data_item);

  const wrapper = mk_stubbed(block.fields[0], d, ctx);
  const quill = wrapper.find(ReactQuill);
  const new_html_value = '<h2>Some wealthy text</h2>';

  quill.prop('onChange')(new_html_value, null, 'user');
  t.is(true,      ctx.value_updated.called);
  t.is(undefined, ctx.should_redraw.called);
  t.is(new_html_value, d.content);
});


test('TextEditor: renders label, passes through is_top_level', t => {
  const wrapper__top    = mk_stubbed(block.fields[0], data_item, {}, true);
  const wrapper__nested = mk_stubbed(block.fields[0], data_item, {}, false);

  const lbl__top    = wrapper__top.find('FieldLabel');
  const lbl__nested = wrapper__nested.find('FieldLabel');

  t.is(1, lbl__top.length);
  t.is(1, lbl__nested.length)
  t.is('Richer text', lbl__top.get(0).props.label);
  t.is(true,  lbl__top.get(0).props.is_top_level);
  t.is(false, lbl__nested.get(0).props.is_top_level);
});

