import React from "react";
import { Block, Elem } from "../../../utils/bem";
import "./RadioGroup.scss";

const RadioContext = React.createContext();

export const RadioGroup = ({ size, value, onChange, children, ...rest }) => {
  const onRadioChange = (e) => {
    onChange?.(e);
  };

  return (
    <RadioContext.Provider
      value={{
        value,
        onChange: onRadioChange,
      }}
    >
      <Block name="radio-group-dm" mod={{ size }} {...rest}>
        <Elem name="buttons">{children}</Elem>
      </Block>
    </RadioContext.Provider>
  );
};

const RadioButton = ({ value, disabled, children, ...props }) => {
  const { onChange, value: currentValue } = React.useContext(RadioContext);
  const checked = value === currentValue;

  return (
    <Elem {...props} tag="label" name="button" mod={{ checked, disabled }}>
      <Elem
        name="input"
        tag="input"
        type="radio"
        value={value}
        checked={value === currentValue}
        onChange={onChange}
        disabled={disabled}
      />
      {children}
    </Elem>
  );
};

RadioGroup.Button = RadioButton;
