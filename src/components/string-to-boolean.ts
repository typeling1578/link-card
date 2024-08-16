export default function stringToBoolean(value: string | null) {
    switch (value) {
        case null:
            return null;
            break;
        case "true":
            return true;
            break;
        case "false":
            return false;
            break;
        default:
            return null;
            break;
    }
}
