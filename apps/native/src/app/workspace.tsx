import { useOrganization, useOrganizationList, useUser } from "@clerk/expo"
import { api } from "@neram/convex/api"
import { useMutation } from "convex/react"
import { router } from "expo-router"
import { Alert } from "react-native"

import { Button, Empty, Row, Screen, Section, Text } from "@/lib/ui"
import {
  canManageOrganizationMember,
  toggledOrganizationRole,
} from "@/lib/sprint-workspace"

export default function WorkspaceScreen() {
  const { user } = useUser()
  const { organization, membership, memberships } = useOrganization({
    memberships: { infinite: true, pageSize: 100 },
  })
  const { createOrganization, setActive, userMemberships } =
    useOrganizationList({
      userMemberships: { infinite: true, pageSize: 100 },
    })
  const beginDeletion = useMutation(api.organizations.beginDeletion)
  const isAdmin = membership?.role === "org:admin"

  const promptCreate = () => {
    Alert.prompt("Create workspace", "Workspace name", (value?: string) => {
      const name = (value ?? "").trim()
      if (!name || !createOrganization) return
      void createOrganization({ name }).then((created) =>
        setActive?.({ organization: created.id })
      )
    })
  }

  const promptInvite = () => {
    if (!organization) return
    Alert.prompt("Invite member", "Email address", (value?: string) => {
      const emailAddress = (value ?? "").trim().toLowerCase()
      if (!emailAddress) return
      void organization
        .inviteMember({ emailAddress, role: "org:member" })
        .then(() => Alert.alert("Invitation sent"))
        .catch(showError)
    })
  }

  const manageMember = (
    member: NonNullable<NonNullable<typeof memberships>["data"]>[number]
  ) => {
    const userId = member.publicUserData?.userId
    if (!canManageOrganizationMember(isAdmin, user?.id, userId)) return
    Alert.alert(memberName(member), member.role, [
      { text: "Cancel", style: "cancel" },
      {
        text: member.role === "org:admin" ? "Make member" : "Make admin",
        onPress: () =>
          void member
            .update({ role: toggledOrganizationRole(member.role) })
            .catch(showError),
      },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          Alert.alert(
            "Remove member?",
            "Their open tasks will be unassigned.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Remove",
                style: "destructive",
                onPress: () => void member.destroy().catch(showError),
              },
            ]
          ),
      },
    ])
  }

  const confirmDeletion = () => {
    if (!organization?.slug) return
    Alert.alert(
      "Delete workspace?",
      `This permanently deletes ${organization.name}, every project, task, Sprint, and activity entry.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            void beginDeletion({
              organizationId: organization.id,
              slug: organization.slug!,
              confirm: true,
            })
              .then(() => {
                Alert.alert(
                  "Deletion started",
                  "Neram will delete Clerk last after all workspace data is purged."
                )
                router.back()
              })
              .catch(showError),
        },
      ]
    )
  }

  return (
    <Screen>
      <Section title="Current workspace">
        {organization ? (
          <>
            <Text>{organization.name}</Text>
            <Text>{membership?.role ?? "member"}</Text>
          </>
        ) : (
          <Empty
            title="No active workspace"
            detail="Choose or create one below."
          />
        )}
      </Section>
      <Section title="Switch workspace">
        {userMemberships.data?.map((item) => (
          <Row
            key={item.id}
            label={item.organization.name}
            systemImage={
              item.organization.id === organization?.id
                ? "checkmark.circle"
                : "building.2"
            }
            onPress={() =>
              void setActive?.({ organization: item.organization.id })
            }
          />
        ))}
        <Button
          label="Create workspace"
          systemImage="plus"
          onPress={promptCreate}
        />
      </Section>
      <Section title="Members">
        {memberships?.data?.map((member) => (
          <Row
            key={member.id}
            label={`${memberName(member)} - ${member.role}`}
            systemImage={
              member.role === "org:admin" ? "person.badge.key" : "person"
            }
            onPress={() => manageMember(member)}
          />
        )) ?? <Text>Loading members...</Text>}
        {isAdmin ? (
          <Button
            label="Invite member"
            systemImage="person.badge.plus"
            onPress={promptInvite}
          />
        ) : null}
      </Section>
      {isAdmin ? (
        <Section title="Danger zone">
          <Button
            label="Delete workspace"
            systemImage="trash"
            onPress={confirmDeletion}
          />
        </Section>
      ) : null}
    </Screen>
  )
}

function memberName(member: {
  publicUserData?: {
    firstName?: string | null
    lastName?: string | null
    identifier?: string
  }
}) {
  const user = member.publicUserData
  return (
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.identifier ||
    "Member"
  )
}

function showError(error: unknown) {
  Alert.alert(
    "Could not update workspace",
    error instanceof Error ? error.message : "Try again."
  )
}
