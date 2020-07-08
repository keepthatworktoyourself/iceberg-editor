import React from 'react';
import Repeater from './Repeater';
import Fields from './fields';
import SubBlock from './SubBlock';
import Utils from './definitions/utils';


export default function RecursiveFieldRenderer(props) {
  const block = props.block;

  return Object.keys(block.fields).map(field_name => {
    const field = block.fields[field_name];

    if (!field.def.type) { throw Error(Utils.Err__FieldNoType()); }
    if (!field.def.name) { throw Error(Utils.Err__FieldNoName()); }

    // Conditional rendering
    if (field.def.display_if && field.def.display_if.constructor === Array) {
      field.should_display = field.def.display_if.reduce((carry, rule) => {
        const sibling = block.fields[rule.sibling] || null;
        const rule_eq  = rule.hasOwnProperty('equal_to');
        const rule_neq = rule.hasOwnProperty('not_equal_to');
        if (!sibling || !(rule_eq || rule_neq)) {
          return carry;
        }
        if (rule_eq) {
          return carry && (sibling.value === rule.equal_to);
        }
        else {
          return carry && (sibling.value !== rule.not_equal_to);
        }
      }, true);

      if (!field.should_display) {
        return null;
      }
    }

    // Render fields
    let out = null;

    if (field.def.type === Fields.SubBlock) {
      out = <SubBlock block={field.value} field={field} contents_hidden={true} key={field.uid} />;
    }

    else if (field.def.type === Fields.SubBlockArray) {
      out = <Repeater block={block} field={field} key={field.uid} />;
    }

    else {
      out = <field.def.type block={block} field={field} key={field.uid} />
    }

    return out;
  });
}

