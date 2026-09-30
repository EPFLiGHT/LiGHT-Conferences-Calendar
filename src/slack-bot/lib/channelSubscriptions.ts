/** Channels the bot was added to, across all workspaces, stored in Redis. */

import type { ChannelSubscription } from '@/types/slack';
import { kvKeys } from './kvKeys';
import { recordStore } from './records';

const channels = recordStore<ChannelSubscription>({
  key: kvKeys.channel.record,
  index: kvKeys.idx.channel,
  pick: ({ channelId, channelName, teamId, addedBy, subscribedAt }) => ({
    channelId,
    channelName,
    teamId,
    addedBy,
    subscribedAt,
  }),
});

export async function subscribeChannel(
  channelId: string,
  channelName: string,
  teamId: string,
  addedBy?: string
): Promise<ChannelSubscription> {
  const subscription = { channelId, channelName, teamId, addedBy, subscribedAt: new Date().toISOString() };
  await channels.put(channelId, subscription);
  return subscription;
}

export function unsubscribeChannel(channelId: string): Promise<void> {
  return channels.remove(channelId);
}

export function getSubscribedChannels(): Promise<ChannelSubscription[]> {
  return channels.all();
}

export async function unsubscribeTeamChannels(teamId: string): Promise<number> {
  const teamChannels = (await channels.all()).filter((channel) => channel.teamId === teamId);
  await Promise.all(teamChannels.map((channel) => channels.remove(channel.channelId)));
  return teamChannels.length;
}
