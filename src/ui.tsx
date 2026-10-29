import React, {useState} from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    type StyleProp,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    type TextInputProps,
    View,
    type ViewStyle,
} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';
import {useColors} from './theme';
import paths from './design/desktop-icons.json';

export type IconName = keyof typeof paths;

export function Icon({
                         name,
                         size = 20,
                         color,
                     }: {
    name: IconName;
    size?: number;
    color?: string;
}) {
    const c = useColors();

    return (
        <Svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color ?? c.secondary}
            strokeWidth={1.65}
            strokeLinecap="round"
            strokeLinejoin="round"
            accessible={Platform.OS === 'web' ? undefined : false}
            aria-hidden={true}
        >
            <Path d={paths[name]}/>
        </Svg>
    );
}

export function Label({
                          children,
                          muted,
                          size = 14,
                          weight = '400',
                          style,
                          ...rest
                      }: React.ComponentProps<typeof Text> & {
    muted?: boolean;
    size?: number;
    weight?: '400' | '500' | '600' | '700';
}) {
    const c = useColors();
    return (
        <Text
            {...rest}
            style={[
                {
                    color: muted ? c.muted : c.text,
                    fontSize: size,
                    lineHeight: size * 1.5,
                    fontWeight: weight,
                    ...(Platform.OS === 'web'
                        ? {fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'}
                        : {}),
                },
                style,
            ]}
        >
            {children}
        </Text>
    );
}

export function Button({
                           title,
                           icon,
                           onPress,
                           subtle,
                           danger,
                           disabled,
                           loading,
                           style,
                       }: {
    title: string;
    icon?: IconName;
    onPress: () => void;
    subtle?: boolean;
    danger?: boolean;
    disabled?: boolean;
    loading?: boolean;
    style?: StyleProp<ViewStyle>;
}) {
    const c = useColors();
    const color = danger ? c.danger : subtle ? c.secondary : c.onAccent;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityState={{disabled: disabled || loading, busy: loading}}
            disabled={disabled || loading}
            onPress={onPress}
            style={({pressed}) => [
                {
                    minHeight: 44,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                    flexDirection: 'row',
                    gap: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: subtle || danger ? c.surface : c.accent,
                    borderWidth: subtle || danger ? 1 : 0,
                    borderColor: c.borderDefault,
                    opacity: disabled || loading ? 0.55 : pressed ? 0.7 : 1,
                },
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={color}/>
            ) : icon ? (
                <Icon name={icon} color={color}/>
            ) : null}
            <Label style={{color, flexShrink: 1}}>{title}</Label>
        </Pressable>
    );
}

export function IconButton({
                               name,
                               label,
                               onPress,
                               disabled,
                           }: {
    name: IconName;
    label: string;
    onPress: () => void;
    disabled?: boolean;
}) {
    const c = useColors();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            disabled={disabled}
            accessibilityState={{disabled}}
            onPress={onPress}
            style={({pressed}) => ({
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? c.pressed : 'transparent',
                opacity: disabled ? 0.4 : 1,
            })}
        >
            <Icon name={name}/>
        </Pressable>
    );
}

export function Card({
                         children,
                         style,
                     }: React.PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
    const c = useColors();
    return (
        <View
            style={[
                {
                    backgroundColor: c.surface,
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: c.border,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}

export function Page({
                         children,
                         scrollRef,
                         ...props
                     }: React.ComponentProps<typeof ScrollView> & {
    scrollRef?: React.Ref<React.ComponentRef<typeof ScrollView>>;
}) {
    const c = useColors();
    return (
        <ScrollView
            ref={scrollRef}
            {...props}
            keyboardShouldPersistTaps="handled"
            style={[{flex: 1, backgroundColor: c.surface}, props.style]}
            contentContainerStyle={[
                {
                    padding: 16,
                    gap: 16,
                    paddingBottom: 24,
                    width: '100%',
                    maxWidth: 800,
                    alignSelf: 'center',
                },
                props.contentContainerStyle,
            ]}
        >
            {children}
        </ScrollView>
    );
}

export function Section({
                            title,
                            icon,
                            action,
                            onPress,
                            disabled,
                        }: {
    title: string;
    icon?: IconName;
    action?: string;
    disabled?: boolean;
    onPress?: () => void;
}) {
    return (
        <View style={styles.row}>
            <View style={[styles.row, {flex: 1, gap: 8}]}>
                {icon && <Icon name={icon} size={18}/>}
                <Label weight="600" size={16}>
                    {title}
                </Label>
            </View>
            {action && onPress && (
                <Pressable
                    accessibilityRole="button"
                    onPress={onPress}
                    disabled={disabled}
                    style={{
                        minHeight: 44,
                        justifyContent: 'center',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                    }}
                >
                    <Label muted size={12}>
                        {action}
                    </Label>
                    {action === '全部' && <Icon name="chevron" size={12}/>}
                </Pressable>
            )}
        </View>
    );
}

export function Empty({
                          icon,
                          title,
                      }: {
    icon: IconName;
    title: string;
    description?: string;
    action?: string;
    onPress?: () => void;
}) {
    const c = useColors();
    return (
        <View style={{alignItems: 'center', paddingVertical: 48, gap: 12}}>
            <Icon name={icon} size={32} color={c.muted}/>
            <Label muted>{title}</Label>
        </View>
    );
}

export function Chips<T extends string | number>({
                                                     options,
                                                     value,
                                                     onChange,
                                                 }: {
    options: readonly { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
}) {
    const c = useColors();
    return (
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 4}}>
            {options.map((item) => (
                <Pressable
                    key={item.value}
                    accessibilityRole="button"
                    accessibilityState={{selected: value === item.value}}
                    onPress={() => onChange(item.value)}
                    style={({pressed}) => ({
                        minHeight: 44,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor:
                            value === item.value ? c.accentSoft : pressed ? c.hover : 'transparent',
                    })}
                >
                    <Label style={{color: value === item.value ? c.onAccentSoft : c.secondary}}>
                        {item.label}
                    </Label>
                </Pressable>
            ))}
        </View>
    );
}

export function Field({
                          label,
                          hint,
                          required,
                          error,
                          ...props
                      }: TextInputProps & { label: string; hint?: string; required?: boolean; error?: string }) {
    const c = useColors();
    return (
        <View style={{gap: 8}}>
            {!!label && (
                <Label weight="500">
                    {label}
                    {required && <Label style={{color: c.danger}}>*</Label>}
                </Label>
            )}
            <TextInput
                {...props}
                accessibilityLabel={props.accessibilityLabel || label}
                aria-invalid={!!error}
                placeholderTextColor={c.muted}
                style={[
                    {
                        color: c.text,
                        fontSize: 16,
                        minHeight: 44,
                        padding: 12,
                        borderRadius: 8,
                        backgroundColor: c.surface,
                        borderWidth: 1,
                        borderColor: error ? c.danger : c.control,
                        textAlignVertical: props.multiline ? 'top' : 'center',
                    },
                    props.style,
                ]}
            />
            {!!error && (
                <Label accessibilityRole="alert" style={{color: c.danger}} size={12}>
                    {error}
                </Label>
            )}
            {hint && (
                <Label muted size={12}>
                    {hint}
                </Label>
            )}
        </View>
    );
}

export function Select<T extends string | number>({
                                                      label,
                                                      value,
                                                      options,
                                                      onChange,
                                                      disabled = false,
                                                      required,
                                                      error,
                                                  }: {
    disabled?: boolean;
    required?: boolean;
    error?: string;
    label: string;
    value: T;
    options: readonly { value: T; label: string }[];
    onChange: (v: T) => void;
}) {
    const c = useColors();
    const [open, setOpen] = useState(false);
    return (
        <View style={{gap: 8}}>
            <Label weight="500">
                {label}
                {required && <Label style={{color: c.danger}}>*</Label>}
            </Label>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={label}
                disabled={disabled}
                accessibilityState={{disabled}}
                aria-invalid={!!error}
                onPress={() => setOpen(true)}
                style={[
                    styles.row,
                    {
                        minHeight: 44,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: error ? c.danger : c.control,
                        borderRadius: 8,
                    },
                ]}
            >
                <Label style={{flex: 1}}>{options.find((o) => o.value === value)?.label || ''}</Label>
                <Icon name="chevron" size={16}/>
            </Pressable>
            {!!error && (
                <Label accessibilityRole="alert" style={{color: c.danger}} size={12}>
                    {error}
                </Label>
            )}
            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <View
                    style={{flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24}}
                >
                    <View
                        style={{maxHeight: '80%', backgroundColor: c.surface, borderRadius: 16, padding: 16}}
                    >
                        <View style={styles.row}>
                            <Label weight="600" style={{flex: 1}}>
                                {label}
                            </Label>
                            <IconButton name="close" label="关闭" onPress={() => setOpen(false)}/>
                        </View>
                        <ScrollView>
                            {options.map((o) => (
                                <Pressable
                                    key={o.value}
                                    accessibilityRole="radio"
                                    accessibilityState={{checked: o.value === value}}
                                    onPress={() => {
                                        onChange(o.value);
                                        setOpen(false);
                                    }}
                                    style={{
                                        minHeight: 44,
                                        padding: 12,
                                        backgroundColor: value === o.value ? c.selected : 'transparent',
                                        borderRadius: 8,
                                    }}
                                >
                                    <Label>{o.label}</Label>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

export function Toggle({
                           title,
                           value,
                           onChange,
                           disabled = false,
                       }: {
    disabled?: boolean;
    title: string;
    description?: string;
    value: boolean;
    onChange: (v: boolean) => void;
}) {
    const c = useColors();
    return (
        <View style={[styles.row, {minHeight: 44}]}>
            <Label style={{flex: 1}}>{title}</Label>
            <Switch
                accessibilityLabel={title}
                disabled={disabled}
                value={value}
                onValueChange={onChange}
                trackColor={{false: c.control, true: c.accent}}
                thumbColor={c.surface}
                {...(Platform.OS === 'web' ? {activeThumbColor: c.surface} : {})}
            />
        </View>
    );
}

export function Banner({message, onDismiss}: { message: string; onDismiss?: () => void }) {
    const c = useColors();
    return (
        <View
            accessibilityRole="alert"
            style={[styles.row, {backgroundColor: c.dangerSoft, padding: 12, borderRadius: 8}]}
        >
            <Label style={{color: c.danger, flex: 1}}>{message}</Label>
            {onDismiss && <IconButton name="close" label="关闭" onPress={onDismiss}/>}
        </View>
    );
}

export function DialogHeader({title, onClose}: { title: string; onClose: () => void }) {
    return (
        <View style={styles.row}>
            <Label weight="600" size={18} style={{flex: 1}}>
                {title}
            </Label>
            <IconButton name="close" label="关闭" onPress={onClose}/>
        </View>
    );
}

export function DateField({
                              label,
                              value,
                              onChange,
                              time = false,
                              optional = false,
                              disabled = false,
                          }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    time?: boolean;
    optional?: boolean;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const c = useColors();
    if (Platform.OS === 'web')
        return <Field label={label} value={value} onChangeText={onChange} editable={!disabled}/>;
    const date = time
        ? new Date('2000-01-01T' + (value || '09:00') + ':00')
        : new Date((value || new Date().toISOString().slice(0, 10)) + 'T12:00:00');
    return (
        <View style={{gap: 8}}>
            <Label weight="500">{label}</Label>
            <View style={styles.row}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    disabled={disabled}
                    onPress={() => setOpen(true)}
                    style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 8,
                        minHeight: 44,
                        borderWidth: 1,
                        borderColor: c.control,
                    }}
                >
                    <Label>{value}</Label>
                </Pressable>
                {optional && !!value && (
                    <IconButton name="close" label={label} disabled={disabled} onPress={() => onChange('')}/>
                )}
            </View>
            {open && (
                <View>
                    <DateTimePicker
                        value={Number.isNaN(date.getTime()) ? new Date() : date}
                        mode={time ? 'time' : 'date'}
                        is24Hour
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        themeVariant={c.dark ? 'dark' : 'light'}
                        onChange={(event, selected) => {
                            if (Platform.OS !== 'ios') setOpen(false);
                            if (event.type === 'dismissed' || !selected) return;
                            onChange(
                                time
                                    ? String(selected.getHours()).padStart(2, '0') +
                                    ':' +
                                    String(selected.getMinutes()).padStart(2, '0')
                                    : selected.getFullYear() +
                                    '-' +
                                    String(selected.getMonth() + 1).padStart(2, '0') +
                                    '-' +
                                    String(selected.getDate()).padStart(2, '0'),
                            );
                        }}
                    />
                    {Platform.OS === 'ios' && <Button title="完成" subtle onPress={() => setOpen(false)}/>}
                </View>
            )}
        </View>
    );
}

export const styles = StyleSheet.create({
    row: {flexDirection: 'row', alignItems: 'center', gap: 12},
    stack: {gap: 16},
    divider: {borderBottomWidth: 1},
    grow: {flex: 1},
    title: {fontSize: 24, lineHeight: 36, fontWeight: '600'},
});
