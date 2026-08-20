import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface ParameterPropertyArraySettingFormProps {
  methods: UseFormReturn<{ type: string; description: string }, any>;
  onConfirm: () => void;
  onCancel: () => void;
}

const ParameterPropertyArraySettingForm = ({ methods, onConfirm, onCancel }: ParameterPropertyArraySettingFormProps) => {
    const { control } = methods;
    const { t } = useTranslation();

    const handleSubmit = (data: { type: string; description: string }) => {
        onConfirm();
    };

    return (
        <Form {...methods}>
            <form onSubmit={methods.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                    control={methods.control}
                    name="type"
                    render={({ field, fieldState: { error } }) => (
                        <FormItem>
                            <FormLabel>{t('Type')}*</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                    <SelectTrigger className={error ? 'border-destructive' : ''}>
                                        <SelectValue placeholder={t('Select type')} />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="string">{t('String')}</SelectItem>
                                    <SelectItem value="number">{t('Number')}</SelectItem>
                                    <SelectItem value="boolean">{t('Boolean')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                
                <FormField
                    control={methods.control}
                    name="description"
                    render={({ field, fieldState: { error } }) => (
                        <FormItem>
                            <FormLabel>{t('Description')}</FormLabel>
                            <FormControl>
                                <Textarea
                                    {...field}
                                    placeholder={t('Description')}
                                    className={error ? 'border-destructive' : ''}
                                    rows={3}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        {t('Cancel')}
                    </Button>
                    <Button type="submit">
                        {t('Confirm')}
                    </Button>
                </div>
            </form>
        </Form>
    );
};

export default ParameterPropertyArraySettingForm;
