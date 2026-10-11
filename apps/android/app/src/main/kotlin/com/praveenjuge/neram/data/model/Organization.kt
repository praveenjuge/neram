package com.praveenjuge.neram.data.model

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

@Serializable
data class Organization(
    @SerialName("_id") val id: DocumentId,
    val organizationId: String,
    val slug: String,
    val name: String,
    val state: State,
) {
    @Serializable
    enum class State {
        @SerialName("active") Active,
        @SerialName("deleting") Deleting,
    }
}

@Serializable
data class Member(
    @SerialName("_id") val id: DocumentId,
    val organizationId: String,
    val membershipId: String,
    val userId: String,
    val role: OrganizationRole,
    val displayName: String,
    val email: String? = null,
    val imageUrl: String? = null,
)

/** Default length for new Sprints: 1, 2, or 4 weeks (a number), or `"open"`. */
@Serializable(with = SprintDuration.Serializer::class)
enum class SprintDuration(val label: String) {
    OneWeek("1 week"),
    TwoWeeks("2 weeks"),
    FourWeeks("4 weeks"),
    Open("No fixed end");

    /** The server's value: weeks as a number, or `"open"`. */
    val wire: JsonPrimitive
        get() =
            when (this) {
                OneWeek -> JsonPrimitive(1.0)
                TwoWeeks -> JsonPrimitive(2.0)
                FourWeeks -> JsonPrimitive(4.0)
                Open -> JsonPrimitive("open")
            }

    object Serializer : KSerializer<SprintDuration> {
        override val descriptor: SerialDescriptor = JsonElement.serializer().descriptor

        override fun deserialize(decoder: Decoder): SprintDuration {
            val element = (decoder as JsonDecoder).decodeJsonElement() as? JsonPrimitive
            return when {
                element == null -> throw SerializationException("Unknown Sprint duration")
                element.isString && element.content == "open" -> Open
                element.doubleOrNull == 1.0 -> OneWeek
                element.doubleOrNull == 2.0 -> TwoWeeks
                element.doubleOrNull == 4.0 -> FourWeeks
                else -> throw SerializationException("Unknown Sprint duration $element")
            }
        }

        override fun serialize(encoder: Encoder, value: SprintDuration) {
            encoder.encodeSerializableValue(JsonElement.serializer(), value.wire)
        }
    }
}

@Serializable data class OrganizationSettings(val sprintDuration: SprintDuration)

/** `organizations:current`: the active workspace and the caller's membership. */
@Serializable
data class CurrentOrganization(
    val organization: Organization,
    val membership: Member,
    val settings: OrganizationSettings? = null,
) {
    val isAdmin: Boolean
        get() = membership.role == OrganizationRole.Admin
}

/** `organizationActions:invite` result. */
@Serializable data class Invitation(val invitationId: String, val status: String)
