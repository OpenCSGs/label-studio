import { format } from "date-fns";
import { NavLink } from "react-router-dom";
import { IconCross } from "@humansignal/icons";
import { Userpic, Button } from "@humansignal/ui";
import { Block, Elem } from "../../../utils/bem";
import "./SelectedUser.scss";
import { useTranslation } from "react-i18next";

const UserProjectsLinks = ({ projects }) => {
  return (
    <Elem name="links-list">
      {projects.map((project) => (
        <Elem
          tag={NavLink}
          name="project-link"
          key={`project-${project.id}`}
          to={`/projects/${project.id}`}
          data-external
        >
          {project.title}
        </Elem>
      ))}
    </Elem>
  );
};

export const SelectedUser = ({ user, onClose }) => {
  const { t } = useTranslation();
  const fullName = [user.first_name, user.last_name]
    .filter((n) => !!n)
    .join(" ")
    .trim();

  return (
    <Block name="user-info">
      <Button
        look="string"
        onClick={onClose}
        className="absolute top-[20px] right-[24px]"
        aria-label={t("organization.closeUserDetails")}
      >
        <IconCross />
      </Button>

      <Elem name="header">
        <Userpic user={user} style={{ width: 64, height: 64, fontSize: 28 }} />
        <Elem name="info-wrapper">
          {fullName && <Elem name="full-name">{fullName}</Elem>}
          <Elem tag="p" name="email">
            {user.email}
          </Elem>
        </Elem>
      </Elem>

      {user.phone && (
        <Elem name="section">
          <a href={`tel:${user.phone}`}>{user.phone}</a>
        </Elem>
      )}

      {!!user.created_projects.length && (
        <Elem name="section">
          <Elem name="section-title">{t("organization.createdProjects")}</Elem>

          <UserProjectsLinks projects={user.created_projects} />
        </Elem>
      )}

      {!!user.contributed_to_projects.length && (
        <Elem name="section">
          <Elem name="section-title">{t("organization.contributedTo")}</Elem>

          <UserProjectsLinks projects={user.contributed_to_projects} />
        </Elem>
      )}

      <Elem tag="p" name="last-active">
        {t("organization.lastActivityOn")}: {format(new Date(user.last_activity), "dd MMM yyyy, KK:mm a")}
      </Elem>
    </Block>
  );
};
