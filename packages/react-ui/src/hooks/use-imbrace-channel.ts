import type { QueryFunction } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { imbraceChannelApi, ChannelCountType } from '@/lib/imbrace/channel';

const fetchChannelCount: QueryFunction<
    string[],
    [string, { viewFilter: string; viewFilterTeamId?: string }]
> = async ({ queryKey }) => {

    const data = await imbraceChannelApi.getChannelCount();

    const channelCountData: ChannelCountType = {
        all: data.count,
        whatsapp: 0,
        web: 0,
        instagram: 0,
        facebook: 0,
        store: 0,
    };

    const availableChannels = Object.entries(channelCountData)
        .filter(([key, value]) => key !== 'all' && key !== 'store' && value !== 0)
        .map(([key]) => key);
    return availableChannels;
};

const useChannels = () => {
    const viewFilter = 'all';
    const viewFilterTeamId = '';
    const { data: channels, isFetching } = useQuery({
        queryKey: [
            'channel_count',
            {
                viewFilter,
                viewFilterTeamId,
            },
        ],
        queryFn: fetchChannelCount,
        initialData: [],
    });

    return { channels, loading: isFetching };
};

export default useChannels;
