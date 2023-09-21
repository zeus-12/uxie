import { Component, FC } from "react";

interface State {
  compact: boolean;
  text: string;
  emoji: string;
}

interface Props {
  onConfirm: (comment: { text: string; emoji: string }) => void;
  onOpen: () => void;
  onUpdate?: () => void;
}

// export const Tip: FC<Props> = (props) => {

export class Tip extends Component<Props, State> {
  // for TipContainer
  componentDidUpdate(nextProps: Props, nextState: State) {
    const { onUpdate } = this.props;

    if (onUpdate && this.state.compact !== nextState.compact) {
      onUpdate();
    }
  }

  render() {
    return (
      <div>
        <div
          className="cursor-pointer bg-[#3d464d] text-white py-[5px] px-[10px] rounded"
          style={{
            border: "1px solid rgba(255, 255, 255, 0.25)",
          }}
          onClick={() => {
            this.setState({ compact: false });
          }}
        >
          Add highlight
        </div>
      </div>
    );
  }
}

export default Tip;
