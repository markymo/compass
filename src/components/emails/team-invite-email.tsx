import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Link,
    Preview,
    Section,
    Text,
    Tailwind,
} from "@react-email/components";
import * as React from "react";

interface TeamInviteEmailProps {
    inviterName: string;
    scopeLabel: string;   // e.g. "Acme Hedge Fund" or "Hornsea 2 SPV"
    role: string;         // e.g. "Client Admin", "Legal Entity Admin", "Supplier Contact"
    inviteLink: string;
    recipientEmail: string;
}

export const TeamInviteEmail = ({
    inviterName,
    scopeLabel,
    role,
    inviteLink,
    recipientEmail,
}: TeamInviteEmailProps) => {
    return (
        <Html>
            <Head />
            <Preview>{inviterName} has invited you to join {scopeLabel} on ONpro</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            You&apos;ve been invited
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            <strong>{inviterName}</strong> has invited you to join <strong>{scopeLabel}</strong> on ONpro.
                        </Text>

                        <Section className="bg-slate-50 p-4 rounded-md border border-slate-200 my-4 text-center">
                            <Text className="text-slate-800 font-semibold text-lg m-0">
                                {scopeLabel}
                            </Text>
                            <Text className="text-slate-500 text-xs m-0 mt-1">
                                Your role: {role}
                            </Text>
                        </Section>

                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Button
                                className="bg-[#4F46E5] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                                href={inviteLink}
                            >
                                Accept Invitation
                            </Button>
                        </Section>
                        <Text className="text-black text-[14px] leading-[24px]">
                            or copy and paste this URL into your browser:{" "}
                            <Link href={inviteLink} className="text-blue-600 no-underline">
                                {inviteLink}
                            </Link>
                        </Text>
                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            This invitation was sent to <span className="text-black">{recipientEmail}</span>. If you were not expecting it, you can safely ignore this email.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default TeamInviteEmail;
