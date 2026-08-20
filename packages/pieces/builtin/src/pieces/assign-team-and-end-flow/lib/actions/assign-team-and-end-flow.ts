import { 
    ActionContext, 
    createAction, 
    DropdownState,
    InputPropertyMap, 
    Property 
} from '@activepieces/pieces-framework';
import { outboundTextMessage, assignTeam, finishWorkflow } from '../utils/assign-team-and-endflow';
import { getAgentsByTeam, getTeamsAll } from '../common/assign-api';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

let cachedImbraceToken: string | undefined;

export const assignTeamAndEndFlow = createAction({
    name: 'assignTeamAndEndFlow',
    displayName: 'Assign Team and End Flow',
    description: 'Call for service and end the flow',
    isEndPiece: true,
    props: {
        // 1. Static Props
        endMessage: Property.LongText({
            displayName: "End Message",
            required: true,
            description: "The message you want to say before conversation ended",
        }),
        assignTeamToggle: Property.Checkbox({
            displayName: 'Assign Team',
            defaultValue: false,
            required: true,
        }),


        // 2. Dynamic Prop for TEAM (Listens to Toggle)
        teamDynamic: Property.DynamicProperties({
            displayName: 'Team Selection',
            refreshers: ['assignTeamToggle'],
            required: false,
            props: async ( propsValue , ctx): Promise<InputPropertyMap> => {
                console.log('ctx assign team', ctx);
                cachedImbraceToken = (ctx as any)?.server?.imbraceToken ?? cachedImbraceToken;
                console.log('cachedImbraceToken assign', cachedImbraceToken);
                
                const isAssigned = propsValue['assignTeamToggle'];
                if (!isAssigned) {
                    return {};
                }

                // Fetch teams data
                let teamsOptions: DropdownState<string>;
                try {
                    const teams = await getTeamsAll(cachedImbraceToken);
                    console.log('teams assign', teams);
                    teamsOptions = {
                        disabled: false,
                        options: teams.map((team) => ({
                            label: team.name,
                            value: team._id,
                        })),
                    };
                } catch (error) {
                    console.error('Error fetching teams:', error);
                    teamsOptions = {
                        disabled: true,
                        options: [],
                        placeholder: 'Error loading teams'
                    };
                }

                return {
                    teamId: Property.StaticDropdown<string>({
                        displayName: 'Team',
                        description: 'Select a team',
                        required: true,
                        options: teamsOptions,
                    }),
                };
            },
        }),

        // 3. Dynamic Prop for USER (Listens to Toggle AND Team)
        userDynamic: Property.DynamicProperties({
            displayName: 'Representative Selection',
            refreshers: ['assignTeamToggle','teamDynamic', 'teamId'],
            required: false,
            props: async ( propsValue , ctx): Promise<InputPropertyMap> => {
                cachedImbraceToken = (ctx as any)?.server?.imbraceToken ?? cachedImbraceToken;
                
                const isAssigned = propsValue['assignTeamToggle'];
                const teamId = propsValue['teamDynamic']['teamId'];
                
                console.log('propsValue for users:', JSON.stringify(propsValue, null, 2));
                console.log('dynamicTeam:', propsValue['teamDynamic']);
                
                console.log('teamId found:', teamId);

                // If toggle is OFF or No Team selected, hide User field
                if (!isAssigned || !teamId) {
                    return {};
                }

                // Fetch users data
                let usersOptions: DropdownState<string>;
                try {
                    const users = await getAgentsByTeam(teamId as unknown as string, cachedImbraceToken as string);
                    console.log('users assign', users);
                    usersOptions = {
                        disabled: false,
                        options: users.map((user) => ({
                            label: user.user.display_name,
                            value: user.user._id,
                        })),
                    };
                } catch (error) {
                    console.error('Error fetching users:', error);
                    usersOptions = {
                        disabled: true,
                        options: [],
                        placeholder: 'Error loading users'
                    };
                }

                return {
                    userId: Property.StaticDropdown<string>({
                        displayName: 'Representative',
                        description: 'Select a representative',
                        required: false,
                        options: usersOptions,
                    }),
                };
            },
        }),
    },

    async run(ctx: ActionContext) {
        // Activepieces merges all dynamic properties into the root propsValue object
        const propsValue = ctx.propsValue as any;
        
        const {
            endMessage,
            assignTeamToggle,
            teamDynamic,
            userDynamic,
        } = propsValue;

        // conversation_id comes from the TRIGGER context, which AP exposes on
        // ctx.triggerCtx (NOT propsValue) with the inbound fields nested under
        // `body`. Same pattern as clip-and-cache. The old code read
        // propsValue.triggerCtx (undefined) → conversation_id was always
        // undefined → the published WORKFLOW.ASSIGN_TEAM message had no
        // conversation_id and the consumer skipped it.
        const anyCtx = ctx as any;
        const triggerCtx = anyCtx.triggerCtx;
        const payload = (triggerCtx && triggerCtx['body'])
            ? { ...triggerCtx, ...triggerCtx['body'] }
            : (triggerCtx || {});
        const conversation_id = propsValue['conversation_id'] || payload['conversation_id'];
        const nodeName = 'assignTeamAndEndFlow';

        // 1. Send End Message
        if (endMessage && endMessage.trim() !== '') {
            await outboundTextMessage(endMessage, conversation_id);
        }

        // 2. Assign Team if enabled
        if (assignTeamToggle) {
            // Access teamId from teamDynamic and userId from userDynamic
            const teamId = teamDynamic?.['teamId'] || propsValue['teamId'];
            const userId = userDynamic?.['userId'] || propsValue['userId'];
            
            if (teamId) {
                console.log(`[${nodeName}] Assigning to team: ${teamId}, Representative: ${userId}`);
                await assignTeam(conversation_id, teamId, userId);
            } else {
                console.log(`[${nodeName}] Assign toggled ON, but no Team ID selected.`);
            }
        }
        
        // 3. Finish Workflow
        await finishWorkflow(conversation_id, nodeName);

        return {
            success: true,
        };
    },
}); 