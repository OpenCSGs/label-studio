import { useMemo } from "react";
import { observer } from "mobx-react";
import { Button, IconChevronLeft, IconChevronRight } from "@humansignal/ui";
import { Block, Elem } from "../../utils/bem";
import { guidGenerator } from "../../utils/unique";
import { isDefined } from "../../utils/utilities";
import { FF_LEAP_1173, FF_TASK_COUNT_FIX, isFF } from "../../utils/feature-flags";
import "./CurrentTask.scss";

export const CurrentTask = observer(({ store }) => {
  const currentIndex = useMemo(() => {
    return store.taskHistory.findIndex((x) => x.taskId === store.task.id) + 1;
  }, [store.taskHistory]);

  const historyEnabled = store.hasInterface("topbar:prevnext");

  // @todo some interface?
  const canPostpone =
    !isDefined(store.annotationStore.selected.pk) &&
    !store.canGoNextTask &&
    (!isFF(FF_LEAP_1173) || store.hasInterface("skip")) &&
    !store.hasInterface("review") &&
    store.hasInterface("postpone");

  return (
    <Elem name="section">
      <Block name="current-task" mod={{ "with-history": historyEnabled }}>
        <Elem name="task-id">
          {store.task.id ?? guidGenerator()}
          {historyEnabled &&
            (isFF(FF_TASK_COUNT_FIX) ? (
              <Elem name="task-count">
                {store.queuePosition} of {store.queueTotal}
              </Elem>
            ) : (
              <Elem name="task-count">
                {currentIndex} of {store.taskHistory.length}
              </Elem>
            ))}
        </Elem>
        {historyEnabled && (
          <Elem name="history-controls">
            <Button
              variant="neutral"
              data-testid="prev-task"
              disabled={!historyEnabled || !store.canGoPrevTask}
              onClick={store.prevTask}
            >
              <IconChevronLeft />
            </Button>
            <Button
              data-testid="next-task"
              disabled={!store.canGoNextTask && !canPostpone}
              onClick={store.canGoNextTask ? store.nextTask : store.postponeTask}
              variant={!store.canGoNextTask && canPostpone ? "primary" : "neutral"}
            >
              <IconChevronRight />
            </Button>
          </Elem>
        )}
      </Block>
    </Elem>
  );
});
