export interface GroupContext {
    //group name
    groupName: String;

    //map containing the username of the group member and their online status as value in map  
    groupMembers: Map<String, Boolean>;

    // group creation timestamp
    createdAt: Date;

    //last used timestamp - when last member disconects
    lastUsedAt: Date;

    // contains username of the user who created the group
    createdBy: String;

    // contains username of the admin user
    groupAdmin:String;
}