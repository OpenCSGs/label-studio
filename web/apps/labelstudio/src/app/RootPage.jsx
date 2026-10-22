import { Menubar } from "../components/Menubar/Menubar";
import { ProjectRoutes } from "../routes/ProjectRoutes";
import { useOrgValidation } from "../hooks/useOrgValidation";

export const RootPage = ({ content }) => {
  useOrgValidation();

  return (
    <Menubar
      enabled={false}
      defaultOpened={false}
      defaultPinned={false}
    >
      <ProjectRoutes content={content} />
    </Menubar>
  );
};
